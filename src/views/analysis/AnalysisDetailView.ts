import { stateOf, statusBadge } from '../../analysis/AnalysisState.ts';
import { styleFor, TYPE_ORDER } from '../../analysis/elementStyle.ts';
import { metersPerPixel } from '../../analysis/scale.ts';
import type { CatalogItem } from '../../models/Catalog.ts';
import type { StructuralElement } from '../../models/StructuralElement.ts';
import { AnalysisService, type AnalysisDetail } from '../../services/AnalysisService.ts';
import { CatalogService, nameOf } from '../../services/CatalogService.ts';
import { Dialog } from '../../ui/Dialog.ts';
import { planOverlay } from '../../ui/planOverlay.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { formatDateTime, formatDuration, formatMeters, formatPercent } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { loadImage } from '../../utils/image.ts';
import { View } from '../View.ts';

/** Below this confidence the inspector suggests reviewing the element. */
const LOW_CONFIDENCE = 0.75;

interface Summary {
  wallThicknessM?: number;
  buildingSizeM?: { width: number; depth: number };
  note?: string;
}

export class AnalysisDetailView extends View {
  title = 'Análisis';

  private readonly service = new AnalysisService();
  private detail: AnalysisDetail | null = null;
  private types: CatalogItem[] = [];
  private materials: CatalogItem[] = [];
  /** Element type the inspector is focused on; null shows every type. */
  private focus: string | null = null;

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

      ${state.hasResults ? this.resultsHtml() : ''}`;

    page.querySelector('[data-delete]')?.addEventListener('click', () => this.confirmDelete());
    if (state.hasResults) await this.mountResults(page);
  }

  private summaryFacts(): string {
    let summary: Summary = {};
    try {
      summary = JSON.parse(this.detail!.analysis.rawResponse ?? '{}') as Summary;
    } catch {
      // Older or foreign responses may not be JSON.
    }
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
            <h2 id="inspector-title">Elementos detectados</h2>
            <p class="field__hint">${
              editable
                ? 'Pasa el mouse por una fila para verla en el plano. Corrige el tipo o el material si la IA se equivocó.'
                : 'Pasa el mouse por una fila para verla en el plano.'
            }</p>
          </header>
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
    this.renderTabs(page);
    this.renderTable(page);
  }

  private overlaySize: [number, number] = [0, 0];

  private renderOverlay(figure: HTMLElement, widthM?: number, heightM?: number): void {
    if (widthM && heightM) this.overlaySize = [widthM, heightM];
    const [w, h] = this.overlaySize;
    figure.innerHTML = planOverlay(this.detail!.plan.fileUrl, w, h, this.detail!.elements, this.types);
    figure.querySelectorAll<SVGElement>('.overlay__el').forEach((shape) => {
      shape.classList.toggle('is-dimmed', this.focus !== null && shape.dataset.type !== this.focus);
      shape.addEventListener('mouseenter', () => this.highlight(shape.dataset.id!, true));
      shape.addEventListener('mouseleave', () => this.highlight(shape.dataset.id!, false));
    });
  }

  /** Elements listed in the inspector: those of the focused type, or all of them. */
  private visibleElements(): StructuralElement[] {
    if (this.focus === null) return this.detail!.elements;
    return this.detail!.elements.filter((e) => nameOf(this.types, e.elementTypeId) === this.focus);
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
        const doubtful = element.confidence < LOW_CONFIDENCE;
        return `
          <li class="element-row ${doubtful ? 'is-doubtful' : ''}" data-id="${element.id}">
            <span class="element-row__index">${index + 1}</span>
            <div class="element-row__main">
              <div class="element-row__fields">
                <span class="legend__swatch" style="background:${styleFor(type).color}"></span>${typeField}${materialField}
              </div>
              <p class="element-row__meta">${this.size(element, type)} <span>${this.position(element)}</span></p>
            </div>
            <div class="element-row__confidence">
              <span class="confidence" style="--value:${element.confidence}">
                <span class="confidence__bar"></span>${formatPercent(element.confidence)}
              </span>
              ${doubtful ? '<span class="badge badge--warning">Revisar</span>' : ''}
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
    });
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

  private async saveField(page: HTMLElement, element: StructuralElement, select: HTMLSelectElement): Promise<void> {
    const value = select.value ? Number(select.value) : null;
    const changes = select.dataset.field === 'elementTypeId' ? { elementTypeId: value! } : { materialId: value };
    try {
      const updated = await this.service.updateElement(this.detail!, element, changes);
      Object.assign(element, updated);
      Toast.success('Elemento corregido.');
      this.renderOverlay(page.querySelector('[data-overlay]')!);
      this.renderTabs(page);
      this.renderTable(page);
    } catch (error) {
      Toast.error(errorMessage(error));
    }
  }

  private async removeElement(page: HTMLElement, element: StructuralElement): Promise<void> {
    try {
      await this.service.removeElement(this.detail!, element);
      this.detail!.elements = this.detail!.elements.filter((e) => e.id !== element.id);
      this.renderOverlay(page.querySelector('[data-overlay]')!);
      this.renderTabs(page);
      this.renderTable(page);
      Toast.success('Elemento quitado del análisis.');
    } catch (error) {
      Toast.error(errorMessage(error));
    }
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
