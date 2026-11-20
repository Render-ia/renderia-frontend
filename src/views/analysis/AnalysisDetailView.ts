import { stateOf, statusBadge } from '../../analysis/AnalysisState.ts';
import {
  ASSUMPTION_TARGETS,
  confirmAssumption,
  parseMeters,
  parseSummary,
  pendingAssumptions,
  SOURCE_LABELS,
  type AnalysisSummary,
  type AssumptionKey,
} from '../../analysis/AnalysisSummary.ts';
import { CommandHistory } from '../../analysis/commands/CommandHistory.ts';
import {
  AddElementCommand,
  CompositeCommand,
  EditElementCommand,
  RemoveElementCommand,
  type ElementCommand,
  type ElementReceiver,
  type MeasureField,
} from '../../analysis/commands/ElementCommand.ts';
import { UpdateSummaryCommand, type SummaryStore } from '../../analysis/commands/SummaryCommand.ts';
import { CONFIDENCE_LEVELS, confidenceLevel, countByLevel, levelInfo, type ConfidenceLevel } from '../../analysis/confidence.ts';
import { styleFor, TYPE_ORDER } from '../../analysis/elementStyle.ts';
import { metersPerPixel } from '../../analysis/scale.ts';
import { Session } from '../../auth/Session.ts';
import type { CatalogItem } from '../../models/Catalog.ts';
import type { StructuralElement, StructuralElementInput } from '../../models/StructuralElement.ts';
import { AnalysisService, type AnalysisDetail } from '../../services/AnalysisService.ts';
import { CatalogService, nameOf } from '../../services/CatalogService.ts';
import { Dialog } from '../../ui/Dialog.ts';
import { planOverlay, type OverlayColorMode } from '../../ui/planOverlay.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { formatDateTime, formatDuration, formatMeters, formatPercent } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { loadImage } from '../../utils/image.ts';
import { View } from '../View.ts';

/** How each type is drawn by hand on the plan: clicks needed and default sizes. */
interface DrawSpec {
  points: 1 | 2;
  material: string | null;
  /** Assumption whose confirmed value gives the height. */
  heightFrom?: AssumptionKey;
  height: number;
  thickness: number;
  width: number | null;
}

const DRAW_SPECS: Record<string, DrawSpec> = {
  Muro: { points: 2, material: 'Ladrillo', heightFrom: 'wallHeight', height: 2.5, thickness: 0.15, width: null },
  Columna: { points: 1, material: 'Concreto reforzado', heightFrom: 'columnHeight', height: 2.8, thickness: 0.3, width: 0.3 },
  Viga: { points: 2, material: 'Concreto reforzado', height: 0.35, thickness: 0.25, width: 0.25 },
  Puerta: { points: 2, material: 'Madera', heightFrom: 'doorHeight', height: 2.1, thickness: 0.15, width: null },
  Ventana: { points: 2, material: null, heightFrom: 'windowHeight', height: 1.2, thickness: 0.15, width: null },
};

/** Lines drawn within this angle of horizontal or vertical are straightened. */
const SNAP_DEGREES = 8;

const MEASURE_LABELS: Record<MeasureField, string> = { height: 'Alto', thickness: 'Espesor', width: 'Ancho' };

interface DrawState {
  type: string;
  points: { x: number; y: number }[];
}

export class AnalysisDetailView extends View {
  title = 'Análisis';

  private readonly service = new AnalysisService();
  private detail: AnalysisDetail | null = null;
  private types: CatalogItem[] = [];
  private materials: CatalogItem[] = [];
  /** Element type the inspector is focused on; null shows every type. */
  private focus: string | null = null;
  private readonly history = new CommandHistory();
  private page: HTMLElement | null = null;
  private summary: AnalysisSummary = parseSummary(null, '');
  private colorBy: OverlayColorMode = 'type';
  /** Confidence level the list is filtered by; null shows every level. */
  private levelFilter: ConfidenceLevel | null = null;
  private drawing: DrawState | null = null;
  /** Rows whose measure editor is open, kept across re-renders. */
  private readonly openMeasures = new Set<number>();
  private readonly onKeydown = (event: KeyboardEvent) => this.shortcut(event);

  constructor(private readonly analysisId: number) {
    super();
  }

  protected render(): string {
    return `<div data-page>${loadingState('Cargando análisis…')}</div>`;
  }

  protected afterRender(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const page = this.root?.querySelector<HTMLElement>('[data-page]');
    if (!page) return;
    try {
      const [detail, catalogs] = await Promise.all([
        this.service.get(this.analysisId),
        CatalogService.getInstance().load(),
      ]);
      this.detail = detail;
      this.types = catalogs.elementTypes;
      this.materials = catalogs.materials;
      this.summary = parseSummary(detail.analysis.rawResponse, detail.plan.scale);
      if (!this.root) return;
      document.title = `Análisis #${detail.analysis.id} · Render.IA`;
      await this.renderPage(page);
    } catch (error) {
      page.innerHTML = `<p class="breadcrumb"><a href="#/analyses">Análisis IA</a></p>${errorState(errorMessage(error), false)}`;
    }
  }

  private async renderPage(page: HTMLElement): Promise<void> {
    const { analysis, plan, project, model, elements } = this.detail!;
    const state = stateOf(analysis.status);
    const canManage = this.service.canEdit(project);

    page.innerHTML = `
      <p class="breadcrumb"><a href="#/analyses">Análisis IA</a> / Análisis #${analysis.id}</p>
      <header class="page-header page-header--row">
        <div>
          <h1>${escapeHtml(project.name)}, piso ${plan.floorLevel}</h1>
          <p class="page-header__lead">${statusBadge(analysis.status)} ${escapeHtml(state.description)}</p>
        </div>
        <div class="page-header__actions">
          ${state.hasResults ? `<a class="button" href="#/viewer/${analysis.id}">Ver modelo 3D</a>` : ''}
          ${state.hasResults ? `<a class="button button--ghost" href="#/analyses/${analysis.id}/budget">Cantidades y presupuesto</a>` : ''}
          <a class="button button--ghost" href="#/analyses/new/${plan.id}">Analizar de nuevo</a>
          ${canManage ? '<button class="button button--ghost button--danger-text" type="button" data-delete>Eliminar</button>' : ''}
        </div>
      </header>

      ${analysis.status === 'FAILED' ? `<p class="form-error">${escapeHtml(analysis.errorMessage ?? 'Error desconocido.')}</p>` : ''}

      <dl class="facts">
        <div><dt>Modelo de IA</dt><dd>${escapeHtml(model?.name ?? 'Modelo eliminado')}</dd></div>
        <div><dt>Fecha</dt><dd>${formatDateTime(analysis.createdAt)}</dd></div>
        <div><dt>Duración</dt><dd>${formatDuration(analysis.durationMs)}</dd></div>
        <div><dt>Elementos</dt><dd>${elements.length}</dd></div>
        ${this.summaryFacts()}
      </dl>

      ${state.hasResults ? '<section class="section validation" aria-labelledby="validation-title" data-validation></section>' : ''}
      ${state.hasResults ? this.resultsHtml() : ''}`;

    page.querySelector('[data-delete]')?.addEventListener('click', () => this.confirmDelete());
    if (state.hasResults) await this.mountResults(page);
  }

  private summaryFacts(): string {
    const summary = this.summary;
    const facts: string[] = [];
    if (summary.buildingSizeM) {
      facts.push(
        `<div><dt>Huella del edificio</dt><dd>${formatMeters(summary.buildingSizeM.width)} × ${formatMeters(summary.buildingSizeM.depth)}</dd></div>`,
      );
    }
    if (summary.wallThicknessM) {
      facts.push(`<div><dt>Espesor típico de muro</dt><dd>${formatMeters(summary.wallThicknessM)}</dd></div>`);
    }
    return facts.join('');
  }

  private resultsHtml(): string {
    const editable = this.service.canEdit(this.detail!.project);
    return `
      <section class="section workbench">
        <figure class="blueprint workbench__plan" data-overlay>${loadingState('Dibujando resultados…')}</figure>
        <section class="inspector" aria-labelledby="inspector-title">
          <header class="inspector__header">
            <div class="inspector__title">
              <h2 id="inspector-title">Elementos detectados</h2>
              ${
                editable
                  ? `<div class="history" role="group" aria-label="Historial de cambios">
                      <button class="button button--ghost button--small" type="button" data-undo disabled>Deshacer</button>
                      <button class="button button--ghost button--small" type="button" data-redo disabled>Rehacer</button>
                    </div>`
                  : ''
              }
            </div>
            <p class="field__hint">${
              editable
                ? 'Pasa el mouse por una fila para verla en el plano. Corrige el tipo o el material si la IA se equivocó.'
                : 'Pasa el mouse por una fila para verla en el plano.'
            }</p>
          </header>
          <div class="inspector__tools">
            <div class="segmented" role="group" aria-label="Color del plano">
              <button type="button" class="segmented__item" data-color="type" aria-pressed="true">Por tipo</button>
              <button type="button" class="segmented__item" data-color="confidence" aria-pressed="false">Por confianza</button>
            </div>
            ${
              editable
                ? `<div class="draw-tool">
                    <select class="select select--compact" data-draw-type aria-label="Tipo del elemento a dibujar">${this.drawOptions()}</select>
                    <button class="button button--small" type="button" data-draw>Dibujar en el plano</button>
                  </div>`
                : ''
            }
          </div>
          <p class="draw-hint" data-draw-hint hidden></p>
          <div class="type-tabs" role="group" aria-label="Filtrar por tipo" data-tabs></div>
          <ol class="inspector__list" data-table aria-label="Elementos"></ol>
        </section>
      </section>`;
  }

  private async mountResults(page: HTMLElement): Promise<void> {
    const { plan } = this.detail!;
    const figure = page.querySelector<HTMLElement>('[data-overlay]')!;
    try {
      const image = await loadImage(plan.fileUrl);
      const mpp = metersPerPixel(plan.scale);
      this.renderOverlay(figure, image.naturalWidth * mpp, image.naturalHeight * mpp);
    } catch (error) {
      figure.innerHTML = errorState(errorMessage(error), false);
    }
    this.page = page;
    this.renderValidation(page);
    this.renderTabs(page);
    this.renderTable(page);
    page.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((button) =>
      button.addEventListener('click', () => {
        this.colorBy = button.dataset.color as OverlayColorMode;
        page.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) =>
          b.setAttribute('aria-pressed', String(b === button)),
        );
        this.renderOverlay(page.querySelector('[data-overlay]')!);
      }),
    );
    if (this.service.canEdit(this.detail!.project)) {
      page.querySelector('[data-undo]')!.addEventListener('click', () => this.undo());
      page.querySelector('[data-redo]')!.addEventListener('click', () => this.redo());
      page.querySelector('[data-draw]')!.addEventListener('click', () => this.toggleDrawing(page));
      document.addEventListener('keydown', this.onKeydown);
    }
  }

  unmount(): void {
    document.removeEventListener('keydown', this.onKeydown);
    this.page = null;
    super.unmount();
  }

  private overlaySize: [number, number] = [0, 0];

  private renderOverlay(figure: HTMLElement, widthM?: number, heightM?: number): void {
    if (widthM && heightM) this.overlaySize = [widthM, heightM];
    const [w, h] = this.overlaySize;
    figure.innerHTML = planOverlay(this.detail!.plan.fileUrl, w, h, this.detail!.elements, this.types, {
      colorBy: this.colorBy,
      rooms: this.summary.rooms,
    });
    const visible = new Set(this.visibleElements().map((e) => String(e.id)));
    figure.querySelectorAll<SVGElement>('.overlay__el').forEach((shape) => {
      shape.classList.toggle('is-dimmed', !visible.has(shape.dataset.id!));
      shape.addEventListener('mouseenter', () => this.highlight(shape.dataset.id!, true));
      shape.addEventListener('mouseleave', () => this.highlight(shape.dataset.id!, false));
    });
    this.wireDrawing(figure);
  }

  /** Elements listed in the inspector: those of the focused type, or all of them. */
  private visibleElements(): StructuralElement[] {
    return this.detail!.elements.filter(
      (e) =>
        (this.focus === null || nameOf(this.types, e.elementTypeId) === this.focus) &&
        (this.levelFilter === null || confidenceLevel(e.confidence) === this.levelFilter),
    );
  }

  /** One tab per detected type; picking one focuses the plan and the list on it. */
  private renderTabs(page: HTMLElement): void {
    const counts = new Map<string, number>();
    for (const element of this.detail!.elements) {
      const type = nameOf(this.types, element.elementTypeId);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const known = TYPE_ORDER.filter((t) => counts.has(t));
    const others = [...counts.keys()].filter((t) => !TYPE_ORDER.includes(t as never));
    if (this.focus !== null && !counts.has(this.focus)) this.focus = null;

    const tab = (value: string, label: string, count: number, swatch = '') => `
      <button class="type-tab" type="button" data-type="${escapeHtml(value)}"
        aria-pressed="${(this.focus ?? '') === value}">
        ${swatch}<span>${escapeHtml(label)}</span><span class="type-tab__count">${count}</span>
      </button>`;

    const tabs = page.querySelector<HTMLElement>('[data-tabs]')!;
    tabs.innerHTML =
      tab('', 'Todos', this.detail!.elements.length) +
      [...known, ...others]
        .map((type) => {
          const style = styleFor(type);
          const label = style.label === 'Otros' ? type : style.label;
          return tab(type, label, counts.get(type)!, `<span class="legend__swatch" style="background:${style.color}"></span>`);
        })
        .join('');

    tabs.querySelectorAll<HTMLButtonElement>('.type-tab').forEach((button) => {
      button.addEventListener('click', () => {
        this.focus = button.dataset.type || null;
        this.renderTabs(page);
        this.renderOverlay(page.querySelector('[data-overlay]')!);
        this.renderTable(page);
      });
    });
  }

  private renderTable(page: HTMLElement): void {
    const list = page.querySelector<HTMLElement>('[data-table]')!;
    const editable = this.service.canEdit(this.detail!.project);
    list.innerHTML = this.visibleElements()
      .map((element, index) => {
        const type = nameOf(this.types, element.elementTypeId);
        const typeField = editable
          ? `<select class="select select--compact" data-field="elementTypeId" aria-label="Tipo del elemento ${index + 1}">${this.options(this.types, element.elementTypeId)}</select>`
          : `<span>${escapeHtml(type)}</span>`;
        const materialField = editable
          ? `<select class="select select--compact" data-field="materialId" aria-label="Material del elemento ${index + 1}"><option value="">Sin material</option>${this.options(this.materials, element.materialId)}</select>`
          : `<span>${escapeHtml(nameOf(this.materials, element.materialId, 'Sin material'))}</span>`;
        const level = levelInfo(confidenceLevel(element.confidence));
        const doubtful = level.level === 'low';
        return `
          <li class="element-row ${doubtful ? 'is-doubtful' : ''}" data-id="${element.id}" style="--level-color:${level.color}">
            <span class="element-row__index">${index + 1}</span>
            <div class="element-row__main">
              <div class="element-row__fields">
                <span class="legend__swatch" style="background:${styleFor(type).color}"></span>${typeField}${materialField}
              </div>
              <p class="element-row__meta">${this.size(element, type)} <span>${this.position(element)}</span></p>
              ${editable ? this.measuresHtml(element, type) : ''}
            </div>
            <div class="element-row__confidence">
              <span class="confidence" style="--value:${element.confidence}">
                <span class="confidence__bar"></span>${formatPercent(element.confidence)}
              </span>
              <span class="level-tag" title="${escapeHtml(level.hint)}">${doubtful ? 'Revisar' : `Confianza ${level.label.toLowerCase()}`}</span>
            </div>
            ${editable ? `<button class="button button--ghost button--small button--danger-text" type="button" data-remove aria-label="Quitar el elemento ${index + 1}">Quitar</button>` : ''}
          </li>`;
      })
      .join('');

    list.querySelectorAll<HTMLElement>('.element-row').forEach((row) => {
      const element = this.detail!.elements.find((e) => e.id === Number(row.dataset.id))!;
      row.addEventListener('mouseenter', () => this.highlight(row.dataset.id!, true));
      row.addEventListener('mouseleave', () => this.highlight(row.dataset.id!, false));
      row.addEventListener('focusin', () => this.highlight(row.dataset.id!, true));
      row.addEventListener('focusout', () => this.highlight(row.dataset.id!, false));
      row.querySelectorAll<HTMLSelectElement>('select').forEach((select) =>
        select.addEventListener('change', () => this.saveField(page, element, select)),
      );
      row.querySelector('[data-remove]')?.addEventListener('click', () => this.removeElement(page, element));
      const measures = row.querySelector<HTMLDetailsElement>('details');
      measures?.addEventListener('toggle', () =>
        measures.open ? this.openMeasures.add(element.id) : this.openMeasures.delete(element.id),
      );
      row.querySelectorAll<HTMLInputElement>('[data-measure]').forEach((input) =>
        input.addEventListener('change', () => this.saveMeasure(page, element, input)),
      );
    });
    if (this.visibleElements().length === 0) {
      list.innerHTML = '<li class="inspector__empty">Ningún elemento cumple el filtro.</li>';
    }
  }

  private measuresHtml(element: StructuralElement, type: string): string {
    const fields: MeasureField[] = ['Columna', 'Puerta', 'Ventana', 'Viga'].includes(type)
      ? ['height', 'thickness', 'width']
      : ['height', 'thickness'];
    const inputs = fields
      .map(
        (field) => `
          <label class="measure">
            <span>${MEASURE_LABELS[field]}</span>
            <input class="input input--compact" type="text" inputmode="decimal" data-measure="${field}"
              value="${element[field] ?? ''}" aria-label="${MEASURE_LABELS[field]} en metros" />
            <span aria-hidden="true">m</span>
          </label>`,
      )
      .join('');
    return `<details class="element-row__measures" ${this.openMeasures.has(element.id) ? 'open' : ''}>
        <summary>Editar medidas</summary>
        <div class="measures">${inputs}</div>
      </details>`;
  }

  private saveMeasure(page: HTMLElement, element: StructuralElement, input: HTMLInputElement): Promise<boolean> | void {
    const field = input.dataset.measure as MeasureField;
    const value = parseMeters(input.value);
    if (value === null) {
      Toast.error('Escribe una medida entre 0,01 y 50 metros.');
      input.value = String(element[field] ?? '');
      return;
    }
    if (value === element[field]) return;
    return this.perform(page, new EditElementCommand(this.receiver(), element, { [field]: value }), 'Medida corregida.');
  }

  // ---------- Validation: confidence, assumptions, warnings, review ----------

  private summaryStore(): SummaryStore {
    const detail = this.detail!;
    return {
      current: () => this.summary,
      save: async (summary) => {
        await this.service.saveSummary(detail, summary);
        this.summary = summary;
      },
    };
  }

  private renderValidation(page: HTMLElement): void {
    const section = page.querySelector<HTMLElement>('[data-validation]');
    if (!section) return;
    const editable = this.service.canEdit(this.detail!.project);
    const summary = this.summary;
    const counts = countByLevel(this.detail!.elements.map((e) => e.confidence));
    const total = this.detail!.elements.length || 1;
    const pending = pendingAssumptions(summary);
    const review = summary.validation;

    const levels = CONFIDENCE_LEVELS.map(
      (info) => `
        <button type="button" class="level-filter" data-level="${info.level}" style="--level-color:${info.color}"
          aria-pressed="${this.levelFilter === info.level}" title="${escapeHtml(info.hint)}">
          <span class="level-filter__count">${counts[info.level]}</span>
          <span class="level-filter__label">${info.label}</span>
        </button>`,
    ).join('');
    const bar = CONFIDENCE_LEVELS.map(
      (info) => `<span style="flex:${counts[info.level] / total};background:${info.color}"></span>`,
    ).join('');

    const assumptions = summary.assumptions
      .map((a) => {
        const target = ASSUMPTION_TARGETS[a.key as AssumptionKey];
        const canConfirm = editable && a.source !== 'confirmed' && a.source !== 'detected';
        const value =
          editable && target
            ? `<input class="input input--compact" type="text" inputmode="decimal" value="${escapeHtml(a.value)}"
                data-assumption-value="${escapeHtml(a.key)}" aria-label="${escapeHtml(a.label)}" />`
            : `<span class="assumption__value">${escapeHtml(a.value || 'Sin dato')}</span>`;
        const action = editable && target
          ? `<button type="button" class="button button--ghost button--small" data-confirm="${escapeHtml(a.key)}">${canConfirm ? 'Confirmar' : 'Aplicar'}</button>`
          : canConfirm
            ? `<button type="button" class="button button--ghost button--small" data-confirm="${escapeHtml(a.key)}">Confirmar</button>`
            : '';
        return `
          <li class="assumption assumption--${a.source}">
            <span class="assumption__label">${escapeHtml(a.label)}</span>
            ${value}
            <span class="source-tag source-tag--${a.source}">${SOURCE_LABELS[a.source]}</span>
            ${action}
          </li>`;
      })
      .join('');

    const warnings = summary.warnings.length
      ? `<ul class="warnings">${summary.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
      : '<p class="field__hint">Sin advertencias del análisis.</p>';
    const reading = [
      summary.rooms.length ? `${summary.rooms.length} espacios con nombre y área` : '',
      summary.dimensions.length ? `${summary.dimensions.length} cotas leídas` : '',
      summary.scaleText ? `escala escrita ${escapeHtml(summary.scaleText)}` : '',
    ].filter(Boolean);

    const status = review
      ? `<span class="badge badge--success">Revisado</span>
         <span class="field__hint">por ${escapeHtml(review.reviewedBy)}, ${formatDateTime(review.reviewedAt)}</span>`
      : `<span class="badge badge--warning">Propuesta sin revisar</span>`;

    section.innerHTML = `
      <header class="validation__header">
        <div>
          <h2 id="validation-title">Validación de la propuesta</h2>
          <p class="field__hint">La IA propone, la geometría construye y tú validas. Confirma los supuestos y revisa lo que tiene confianza baja.</p>
        </div>
        <div class="validation__status">
          ${status}
          ${editable && !review ? '<button type="button" class="button button--small" data-review>Marcar como revisado</button>' : ''}
        </div>
      </header>
      <div class="validation__grid">
        <article class="validation__card">
          <h3>Confianza</h3>
          <div class="level-bar" aria-hidden="true">${bar}</div>
          <div class="level-filters" role="group" aria-label="Filtrar por confianza">${levels}</div>
          <p class="field__hint">Toca un nivel para ver solo esos elementos en el plano y en la lista.</p>
        </article>
        <article class="validation__card validation__card--wide">
          <h3>Supuestos ${pending ? `<span class="badge badge--warning">${pending} por confirmar</span>` : '<span class="badge badge--success">Todo confirmado</span>'}</h3>
          <ul class="assumptions">${assumptions}</ul>
          <p class="field__hint">Al cambiar una altura o un espesor se actualizan todos los elementos de ese tipo en un solo paso (se puede deshacer).</p>
        </article>
        <article class="validation__card">
          <h3>Advertencias</h3>
          ${warnings}
          ${reading.length ? `<p class="field__hint">La IA leyó del plano: ${reading.join(', ')}.</p>` : ''}
        </article>
      </div>`;

    section.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((button) =>
      button.addEventListener('click', () => {
        const level = button.dataset.level as ConfidenceLevel;
        this.levelFilter = this.levelFilter === level ? null : level;
        this.refresh(page);
      }),
    );
    section.querySelectorAll<HTMLButtonElement>('[data-confirm]').forEach((button) =>
      button.addEventListener('click', () => this.confirmAssumptionRow(page, button.dataset.confirm!)),
    );
    section.querySelectorAll<HTMLInputElement>('[data-assumption-value]').forEach((input) =>
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') this.confirmAssumptionRow(page, input.dataset.assumptionValue!);
      }),
    );
    section.querySelector('[data-review]')?.addEventListener('click', () => this.markReviewed(page));
  }

  /**
   * Confirms an assumption. When it maps to a measure (wall height, slab
   * thickness...) every element of that type takes the value, all in one
   * undoable step together with the summary.
   */
  private async confirmAssumptionRow(page: HTMLElement, key: string): Promise<void> {
    const row = this.summary.assumptions.find((a) => a.key === key);
    if (!row) return;
    const target = ASSUMPTION_TARGETS[key as AssumptionKey];
    const commands: ElementCommand[] = [];
    let value = row.value;

    if (target) {
      const input = page.querySelector<HTMLInputElement>(`[data-assumption-value="${CSS.escape(key)}"]`);
      const meters = parseMeters(input?.value ?? row.value);
      if (meters === null) {
        Toast.error('Escribe una medida entre 0,01 y 50 metros.');
        return;
      }
      value = `${meters} m`;
      for (const element of this.detail!.elements) {
        if (nameOf(this.types, element.elementTypeId) === target.type && element[target.field] !== meters) {
          commands.push(new EditElementCommand(this.receiver(), element, { [target.field]: meters }));
        }
      }
    }

    const label = `confirmar ${row.label.toLowerCase()}`;
    commands.push(new UpdateSummaryCommand(this.summaryStore(), confirmAssumption(this.summary, key, value), label));
    const changed = commands.length - 1;
    await this.perform(
      page,
      new CompositeCommand(label, commands),
      changed > 0 ? `${row.label}: ${value}. Se actualizaron ${changed} elementos.` : `${row.label} confirmado.`,
    );
  }

  private async markReviewed(page: HTMLElement): Promise<void> {
    const pending = pendingAssumptions(this.summary);
    const low = countByLevel(this.detail!.elements.map((e) => e.confidence)).low;
    if (pending > 0 || low > 0) {
      const parts = [
        pending ? `${pending} supuestos sin confirmar` : '',
        low ? `${low} elementos con confianza baja` : '',
      ].filter(Boolean);
      const confirmed = await Dialog.confirm({
        title: 'Marcar como revisado',
        message: `Todavía hay ${parts.join(' y ')}. ¿Quieres marcar la propuesta como revisada de todas formas?`,
        confirmLabel: 'Marcar como revisado',
      });
      if (!confirmed) return;
    }
    const next: AnalysisSummary = {
      ...this.summary,
      validation: {
        reviewedAt: new Date().toISOString(),
        reviewedBy: Session.getInstance().user?.fullName ?? 'Usuario',
      },
    };
    const command = new UpdateSummaryCommand(this.summaryStore(), next, 'marcar como revisado');
    if (await this.perform(page, command, 'Propuesta marcada como revisada.')) this.service.markReviewed(this.detail!);
  }

  // ---------- Drawing elements the AI missed ----------

  private drawOptions(): string {
    return Object.keys(DRAW_SPECS)
      .filter((type) => this.types.some((t) => t.name === type))
      .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(styleFor(type).label === 'Otros' ? type : styleFor(type).label)}</option>`)
      .join('');
  }

  private toggleDrawing(page: HTMLElement): void {
    if (this.drawing) {
      this.stopDrawing(page);
      return;
    }
    const type = page.querySelector<HTMLSelectElement>('[data-draw-type]')?.value;
    if (!type || !DRAW_SPECS[type]) return;
    this.drawing = { type, points: [] };
    this.updateDrawUi(page);
  }

  private stopDrawing(page: HTMLElement): void {
    this.drawing = null;
    this.updateDrawUi(page);
    page.querySelector('[data-draft]')?.replaceChildren();
  }

  private updateDrawUi(page: HTMLElement): void {
    const button = page.querySelector<HTMLButtonElement>('[data-draw]');
    const hint = page.querySelector<HTMLElement>('[data-draw-hint]');
    const figure = page.querySelector<HTMLElement>('[data-overlay]');
    figure?.classList.toggle('is-drawing', this.drawing !== null);
    if (button) button.textContent = this.drawing ? 'Cancelar dibujo' : 'Dibujar en el plano';
    if (!hint) return;
    if (!this.drawing) {
      hint.hidden = true;
      return;
    }
    const spec = DRAW_SPECS[this.drawing.type];
    hint.hidden = false;
    hint.textContent =
      spec.points === 1
        ? `Haz clic en el plano donde va la ${this.drawing.type.toLowerCase()}. Esc para cancelar.`
        : this.drawing.points.length === 0
          ? `Haz clic donde empieza el elemento (${this.drawing.type.toLowerCase()}). Esc para cancelar.`
          : 'Ahora haz clic donde termina. Las líneas casi rectas se enderezan solas.';
  }

  /** Converts a mouse position to meters in the plan. */
  private toPlan(svg: SVGSVGElement, event: MouseEvent): { x: number; y: number } | null {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const [w, h] = this.overlaySize;
    return { x: Math.min(w, Math.max(0, point.x)), y: Math.min(h, Math.max(0, point.y)) };
  }

  private snap(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
    const angle = Math.abs((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI) % 180;
    if (angle < SNAP_DEGREES || angle > 180 - SNAP_DEGREES) return { x: to.x, y: from.y };
    if (Math.abs(angle - 90) < SNAP_DEGREES) return { x: from.x, y: to.y };
    return to;
  }

  private wireDrawing(figure: HTMLElement): void {
    const svg = figure.querySelector<SVGSVGElement>('svg.overlay');
    const draft = figure.querySelector<SVGGElement>('[data-draft]');
    if (!svg || !draft) return;
    figure.classList.toggle('is-drawing', this.drawing !== null);

    svg.addEventListener('mousemove', (event) => {
      const start = this.drawing?.points[0];
      const point = this.drawing && this.toPlan(svg, event);
      if (!start || !point) return;
      const end = this.snap(start, point);
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      draft.innerHTML = `
        <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" class="overlay__draft-line" />
        <text x="${(start.x + end.x) / 2}" y="${(start.y + end.y) / 2 - 0.2}" class="overlay__draft-label">${length.toFixed(2)} m</text>`;
    });

    svg.addEventListener('click', (event) => {
      if (!this.drawing || !this.page) return;
      const point = this.toPlan(svg, event);
      if (!point) return;
      const spec = DRAW_SPECS[this.drawing.type];
      if (spec.points === 2 && this.drawing.points.length === 0) {
        this.drawing.points.push(point);
        draft.innerHTML = `<circle cx="${point.x}" cy="${point.y}" r="0.08" class="overlay__draft-point" />`;
        this.updateDrawUi(this.page);
        return;
      }
      const start = this.drawing.points[0] ?? point;
      const end = spec.points === 2 ? this.snap(start, point) : point;
      if (spec.points === 2 && Math.hypot(end.x - start.x, end.y - start.y) < 0.2) {
        Toast.error('El elemento es muy corto. Haz clic un poco más lejos.');
        return;
      }
      this.addDrawnElement(this.page, this.drawing.type, start, end);
    });
  }

  private addDrawnElement(
    page: HTMLElement,
    type: string,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): Promise<boolean> {
    const spec = DRAW_SPECS[type];
    const round = (n: number) => Number(n.toFixed(2));
    const assumed = spec.heightFrom
      ? parseMeters(this.summary.assumptions.find((a) => a.key === spec.heightFrom)?.value ?? '')
      : null;
    const length = round(Math.hypot(end.x - start.x, end.y - start.y));
    const input: StructuralElementInput = {
      elementTypeId: this.types.find((t) => t.name === type)!.id,
      materialId: spec.material ? (this.materials.find((m) => m.name === spec.material)?.id ?? null) : null,
      startX: round(start.x),
      startY: round(start.y),
      endX: spec.points === 2 ? round(end.x) : null,
      endY: spec.points === 2 ? round(end.y) : null,
      width: spec.width ?? (type === 'Puerta' || type === 'Ventana' ? length : null),
      height: assumed ?? spec.height,
      thickness: spec.thickness,
      // Drawn by a person: it is a fact, not a guess.
      confidence: 1,
    };
    this.stopDrawing(page);
    return this.perform(page, new AddElementCommand(this.receiver(), input), `${type} agregado al análisis.`);
  }

  private options(items: CatalogItem[], selected: number | null): string {
    return items
      .map((item) => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`)
      .join('');
  }

  private position(element: StructuralElement): string {
    const start = `(${element.startX.toFixed(2)}, ${element.startY.toFixed(2)})`;
    if (element.endX === null || element.endY === null) return start;
    return `${start} → (${element.endX.toFixed(2)}, ${element.endY.toFixed(2)})`;
  }

  private size(element: StructuralElement, type: string): string {
    if (type === 'Columna') return `${formatMeters(element.width)} × ${formatMeters(element.thickness)}`;
    if (element.endX === null || element.endY === null) return formatMeters(element.thickness);
    const length = Math.hypot(element.endX - element.startX, element.endY - element.startY);
    if (type === 'Losa') {
      return `${formatMeters(Math.abs(element.endX - element.startX))} × ${formatMeters(Math.abs(element.endY - element.startY))}`;
    }
    return `L ${formatMeters(length)} · e ${formatMeters(element.thickness)}`;
  }

  private highlight(id: string, on: boolean): void {
    this.root?.querySelectorAll(`[data-id="${id}"]`).forEach((el) => el.classList.toggle('is-highlighted', on));
  }

  private saveField(page: HTMLElement, element: StructuralElement, select: HTMLSelectElement): Promise<boolean> {
    const value = select.value ? Number(select.value) : null;
    const changes = select.dataset.field === 'elementTypeId' ? { elementTypeId: value! } : { materialId: value };
    return this.perform(page, new EditElementCommand(this.receiver(), element, changes), 'Elemento corregido.');
  }

  private removeElement(page: HTMLElement, element: StructuralElement): Promise<boolean> {
    return this.perform(page, new RemoveElementCommand(this.receiver(), element), 'Elemento quitado del análisis.');
  }

  /** Lets the commands read and save the elements of this analysis. */
  private receiver(): ElementReceiver {
    const detail = this.detail!;
    return {
      elements: detail.elements,
      update: (element, changes) => this.service.updateElement(detail, element, changes),
      remove: (element) => this.service.removeElement(detail, element),
      restore: (input) => this.service.restoreElement(detail, input),
    };
  }

  /** Runs a command through the history; true when it was applied. */
  private async perform(page: HTMLElement, command: ElementCommand, message: string): Promise<boolean> {
    let applied = false;
    try {
      await this.history.run(command);
      Toast.success(message);
      applied = true;
    } catch (error) {
      Toast.error(errorMessage(error));
    }
    this.refresh(page);
    return applied;
  }

  private async undo(): Promise<void> {
    if (!this.page || !this.history.canUndo) return;
    try {
      const command = await this.history.undo();
      if (command) Toast.success(`Deshecho: ${command.label}.`);
    } catch (error) {
      Toast.error(errorMessage(error));
    }
    this.refresh(this.page);
  }

  private async redo(): Promise<void> {
    if (!this.page || !this.history.canRedo) return;
    try {
      const command = await this.history.redo();
      if (command) Toast.success(`Rehecho: ${command.label}.`);
    } catch (error) {
      Toast.error(errorMessage(error));
    }
    this.refresh(this.page);
  }

  /** Ctrl+Z undoes; Ctrl+Shift+Z or Ctrl+Y redoes. Native undo inside text fields is left alone. */
  private shortcut(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.drawing && this.page) {
      this.stopDrawing(this.page);
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      this.redo();
    }
  }

  private refresh(page: HTMLElement): void {
    if (!this.root) return;
    this.renderValidation(page);
    this.renderOverlay(page.querySelector('[data-overlay]')!);
    this.renderTabs(page);
    this.renderTable(page);
    this.renderHistory(page);
  }

  private renderHistory(page: HTMLElement): void {
    const undo = page.querySelector<HTMLButtonElement>('[data-undo]');
    const redo = page.querySelector<HTMLButtonElement>('[data-redo]');
    if (!undo || !redo) return;
    undo.disabled = !this.history.canUndo;
    redo.disabled = !this.history.canRedo;
    undo.title = this.history.nextUndo ? `Deshacer: ${this.history.nextUndo} (Ctrl+Z)` : 'Nada que deshacer';
    redo.title = this.history.nextRedo ? `Rehacer: ${this.history.nextRedo} (Ctrl+Shift+Z)` : 'Nada que rehacer';
  }

  private async confirmDelete(): Promise<void> {
    const confirmed = await Dialog.confirm({
      title: 'Eliminar análisis',
      message: 'Se eliminarán los elementos detectados y el modelo 3D de este análisis.',
      confirmLabel: 'Eliminar análisis',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.service.remove(this.detail!);
      Toast.success('Análisis eliminado.');
      window.location.hash = '/analyses';
    } catch (error) {
      Toast.error(errorMessage(error));
    }
  }
}
