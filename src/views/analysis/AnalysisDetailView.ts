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
  private hidden = new Set<string>();

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
          <h1>${escapeHtml(project.name)} · Piso ${plan.floorLevel}</h1>
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
    return `
      <section class="section">
        <div class="analysis-layout">
          <figure class="analysis-plan" data-overlay>${loadingState('Dibujando resultados…')}</figure>
          <aside class="legend" aria-label="Tipos de elemento">
            <h2>Detectado</h2>
            <ul class="legend__list" data-legend></ul>
            <p class="field__hint">Desmarca un tipo para ocultarlo del plano y de la tabla.</p>
          </aside>
        </div>
      </section>
      <section class="section">
        <div class="section__header">
          <h2>Elementos</h2>
          <p class="field__hint">${this.service.canEdit(this.detail!.project) ? 'Corrige el tipo o el material si la IA se equivocó.' : ''}</p>
        </div>
        <div class="table-wrap"><table class="table" data-table></table></div>
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
    this.renderLegend(page);
    this.renderTable(page);
  }

  private overlaySize: [number, number] = [0, 0];

  private renderOverlay(figure: HTMLElement, widthM?: number, heightM?: number): void {
    if (widthM && heightM) this.overlaySize = [widthM, heightM];
    const [w, h] = this.overlaySize;
    figure.innerHTML = planOverlay(this.detail!.plan.fileUrl, w, h, this.visibleElements(), this.types);
    figure.querySelectorAll<SVGElement>('.overlay__el').forEach((shape) => {
      shape.addEventListener('mouseenter', () => this.highlight(shape.dataset.id!, true));
      shape.addEventListener('mouseleave', () => this.highlight(shape.dataset.id!, false));
    });
  }

  private visibleElements(): StructuralElement[] {
    return this.detail!.elements.filter((e) => !this.hidden.has(nameOf(this.types, e.elementTypeId)));
  }

  private renderLegend(page: HTMLElement): void {
    const counts = new Map<string, number>();
    for (const element of this.detail!.elements) {
      const type = nameOf(this.types, element.elementTypeId);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const known = TYPE_ORDER.filter((t) => counts.has(t));
    const others = [...counts.keys()].filter((t) => !TYPE_ORDER.includes(t as never));

    const legend = page.querySelector<HTMLElement>('[data-legend]')!;
    legend.innerHTML = [...known, ...others]
      .map(
        (type) => `
          <li>
            <label class="legend__item">
              <input type="checkbox" value="${escapeHtml(type)}" ${this.hidden.has(type) ? '' : 'checked'} />
              <span class="legend__swatch" style="background:${styleFor(type).color}"></span>
              <span class="legend__name">${escapeHtml(styleFor(type).label === 'Otros' ? type : styleFor(type).label)}</span>
              <span class="legend__count">${counts.get(type)}</span>
            </label>
          </li>`,
      )
      .join('');

    legend.querySelectorAll<HTMLInputElement>('input').forEach((box) => {
      box.addEventListener('change', () => {
        if (box.checked) this.hidden.delete(box.value);
        else this.hidden.add(box.value);
        this.renderOverlay(page.querySelector('[data-overlay]')!);
        this.renderTable(page);
      });
    });
  }

  private renderTable(page: HTMLElement): void {
    const table = page.querySelector<HTMLTableElement>('[data-table]')!;
    const editable = this.service.canEdit(this.detail!.project);
    const rows = this.visibleElements()
      .map((element, index) => {
        const type = nameOf(this.types, element.elementTypeId);
        const typeCell = editable
          ? `<select class="select select--compact" data-field="elementTypeId" aria-label="Tipo">${this.options(this.types, element.elementTypeId)}</select>`
          : escapeHtml(type);
        const materialCell = editable
          ? `<select class="select select--compact" data-field="materialId" aria-label="Material"><option value="">Sin material</option>${this.options(this.materials, element.materialId)}</select>`
          : escapeHtml(nameOf(this.materials, element.materialId, 'Sin material'));
        return `
          <tr data-id="${element.id}">
            <td class="num">${index + 1}</td>
            <td><span class="legend__swatch" style="background:${styleFor(type).color}"></span> ${typeCell}</td>
            <td>${materialCell}</td>
            <td>${this.position(element)}</td>
            <td>${this.size(element, type)}</td>
            <td>
              <span class="confidence" style="--value:${element.confidence}">
                <span class="confidence__bar"></span>${formatPercent(element.confidence)}
              </span>
            </td>
            <td>${editable ? `<button class="button button--ghost button--small button--danger-text" type="button" data-remove>Quitar</button>` : ''}</td>
          </tr>`;
      })
      .join('');

    table.innerHTML = `
      <thead>
        <tr><th class="num">#</th><th>Tipo</th><th>Material</th><th>Posición</th><th>Medidas</th><th>Confianza</th><th><span class="sr-only">Acciones</span></th></tr>
      </thead>
      <tbody>${rows}</tbody>`;

    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
      const element = this.detail!.elements.find((e) => e.id === Number(row.dataset.id))!;
      row.addEventListener('mouseenter', () => this.highlight(row.dataset.id!, true));
      row.addEventListener('mouseleave', () => this.highlight(row.dataset.id!, false));
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
      this.renderLegend(page);
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
      this.renderLegend(page);
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
