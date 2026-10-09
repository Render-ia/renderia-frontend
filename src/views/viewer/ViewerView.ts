import { styleFor, TYPE_ORDER } from '../../analysis/elementStyle.ts';
import { Session } from '../../auth/Session.ts';
import type { CatalogItem } from '../../models/Catalog.ts';
import { logActivity } from '../../services/ActivityLogger.ts';
import { AnalysisService, type AnalysisDetail } from '../../services/AnalysisService.ts';
import { CatalogService, nameOf } from '../../services/CatalogService.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { formatMeters, formatPercent } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import type { ModelViewer, PickedElement } from '../../viewer/ModelViewer.ts';
import type { ColorMode } from '../../viewer/StructuralSceneBuilder.ts';
import { View } from '../View.ts';

/** 3D model of one analysis. Three.js is loaded only when this screen opens. */
export class ViewerView extends View {
  title = 'Visor 3D';

  private viewer: ModelViewer | null = null;
  private detail: AnalysisDetail | null = null;
  private types: CatalogItem[] = [];
  private materials: CatalogItem[] = [];
  private colorMode: ColorMode = 'type';
  private hidden = new Set<string>();

  constructor(private readonly analysisId: number) {
    super();
  }

  protected render(): string {
    return `<div data-page>${loadingState('Preparando el modelo 3D…')}</div>`;
  }

  protected afterRender(): void {
    this.load();
  }

  unmount(): void {
    this.viewer?.dispose();
    this.viewer = null;
    super.unmount();
  }

  private async load(): Promise<void> {
    const page = this.root?.querySelector<HTMLElement>('[data-page]');
    if (!page) return;
    try {
      const [detail, catalogs] = await Promise.all([
        new AnalysisService().get(this.analysisId),
        CatalogService.getInstance().load(),
      ]);
      if (detail.analysis.status !== 'COMPLETED') {
        throw new Error('Este análisis no terminó bien, así que no tiene modelo 3D. Vuelve a analizar el plano.');
      }
      this.detail = detail;
      this.types = catalogs.elementTypes;
      this.materials = catalogs.materials;
      if (!this.root) return;
      document.title = `3D · ${detail.project.name} · Render.IA`;
      this.renderPage(page);
      await this.mountViewer(page);
    } catch (error) {
      page.innerHTML = `<p class="breadcrumb"><a href="#/viewer">Visor 3D</a></p>${errorState(errorMessage(error), false)}`;
    }
  }

  private renderPage(page: HTMLElement): void {
    const { analysis, plan, project, elements } = this.detail!;
    const canExport = Session.getInstance().can('models:export');

    page.innerHTML = `
      <p class="breadcrumb"><a href="#/viewer">Visor 3D</a> / <a href="#/analyses/${analysis.id}">Análisis #${analysis.id}</a></p>
      <header class="page-header page-header--row">
        <div>
          <h1>${escapeHtml(project.name)} · Piso ${plan.floorLevel}</h1>
          <p class="page-header__lead">Modelo estructural con ${elements.length} elementos detectados.</p>
        </div>
        <div class="page-header__actions">
          <button class="button button--ghost" type="button" data-shot>Descargar imagen</button>
          ${
            canExport
              ? '<button class="button" type="button" data-export>Exportar GLB</button>'
              : '<span class="field__hint">Tu rol no permite exportar el modelo.</span>'
          }
        </div>
      </header>

      <div class="viewer">
        <div class="viewer__stage" data-stage>
          <div class="viewer__toolbar" role="toolbar" aria-label="Controles de la vista">
            <button class="viewer__tool" type="button" data-view="3d">Vista 3D</button>
            <button class="viewer__tool" type="button" data-view="top">Vista superior</button>
            <span class="viewer__divider"></span>
            <button class="viewer__tool viewer__tool--on" type="button" data-color="type" aria-pressed="true">Color por tipo</button>
            <button class="viewer__tool" type="button" data-color="material" aria-pressed="false">Color por material</button>
          </div>
          <div class="viewer__info" data-info hidden></div>
          <p class="viewer__help">Arrastra para girar · Rueda para acercar · Clic derecho para mover · Clic en un elemento para ver sus datos</p>
        </div>
        <aside class="legend" aria-label="Capas del modelo">
          <h2>Capas</h2>
          <ul class="legend__list" data-legend></ul>
        </aside>
      </div>`;

    page.querySelector('[data-view="3d"]')!.addEventListener('click', () => this.viewer?.resetCamera());
    page.querySelector('[data-view="top"]')!.addEventListener('click', () => this.viewer?.topView());
    page.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((button) =>
      button.addEventListener('click', () => {
        this.colorMode = button.dataset.color as ColorMode;
        page.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) => {
          const on = b === button;
          b.classList.toggle('viewer__tool--on', on);
          b.setAttribute('aria-pressed', String(on));
        });
        this.rebuild();
        this.renderLegend(page);
      }),
    );
    page.querySelector('[data-shot]')!.addEventListener('click', () => this.downloadImage());
    page.querySelector('[data-export]')?.addEventListener('click', (event) => this.exportGlb(event.currentTarget as HTMLButtonElement));
    this.renderLegend(page);
  }

  private async mountViewer(page: HTMLElement): Promise<void> {
    const stage = page.querySelector<HTMLElement>('[data-stage]')!;
    const { ModelViewer } = await import('../../viewer/ModelViewer.ts');
    if (!this.root) return;
    this.viewer = new ModelViewer(stage, (picked) => this.showInfo(page, picked));
    await this.rebuild();
  }

  private async rebuild(): Promise<void> {
    if (!this.viewer) return;
    const { StructuralSceneBuilder } = await import('../../viewer/StructuralSceneBuilder.ts');
    const content = new StructuralSceneBuilder()
      .withBackground('#eef2f1')
      .withElements(this.detail!.elements, this.types, this.materials, this.colorMode)
      .withGround()
      .withLights()
      .build();
    this.viewer.show(content);
    this.hidden.forEach((type) => this.viewer!.setVisible(type, false));
  }

  private renderLegend(page: HTMLElement): void {
    const counts = new Map<string, number>();
    for (const element of this.detail!.elements) {
      const type = nameOf(this.types, element.elementTypeId, 'Otro');
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const ordered = [...TYPE_ORDER.filter((t) => counts.has(t)), ...[...counts.keys()].filter((t) => !TYPE_ORDER.includes(t as never))];
    const legend = page.querySelector<HTMLElement>('[data-legend]')!;
    legend.innerHTML = ordered
      .map(
        (type) => `
          <li>
            <label class="legend__item">
              <input type="checkbox" value="${escapeHtml(type)}" ${this.hidden.has(type) ? '' : 'checked'} />
              ${this.colorMode === 'type' ? `<span class="legend__swatch" style="background:${styleFor(type).color}"></span>` : ''}
              <span class="legend__name">${escapeHtml(type)}</span>
              <span class="legend__count">${counts.get(type)}</span>
            </label>
          </li>`,
      )
      .join('');

    legend.querySelectorAll<HTMLInputElement>('input').forEach((box) =>
      box.addEventListener('change', () => {
        if (box.checked) this.hidden.delete(box.value);
        else this.hidden.add(box.value);
        this.viewer?.setVisible(box.value, box.checked);
      }),
    );
  }

  private showInfo(page: HTMLElement, picked: PickedElement | null): void {
    const info = page.querySelector<HTMLElement>('[data-info]')!;
    const element = picked && this.detail!.elements.find((e) => e.id === picked.elementId);
    if (!picked || !element) {
      info.hidden = true;
      return;
    }
    const rows: [string, string][] = [
      ['Material', picked.materialName || 'Sin material'],
      ['Confianza de la IA', formatPercent(element.confidence)],
    ];
    if (element.endX !== null && element.endY !== null && picked.typeName !== 'Losa') {
      rows.push(['Largo', formatMeters(Math.hypot(element.endX - element.startX, element.endY - element.startY))]);
    }
    if (element.width !== null) rows.push(['Ancho', formatMeters(element.width)]);
    if (element.thickness !== null) rows.push(['Espesor', formatMeters(element.thickness)]);
    if (element.height !== null) rows.push(['Alto', formatMeters(element.height)]);

    info.innerHTML = `
      <h3><span class="legend__swatch" style="background:${styleFor(picked.typeName).color}"></span> ${escapeHtml(picked.typeName)} #${element.id}</h3>
      <dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>`;
    info.hidden = false;
  }

  private fileBase(): string {
    const { project, plan } = this.detail!;
    const slug = project.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${slug || 'renderia'}-piso-${plan.floorLevel}`;
  }

  private async downloadImage(): Promise<void> {
    try {
      download(await this.viewer!.screenshot(), `${this.fileBase()}.png`);
    } catch (error) {
      Toast.error(errorMessage(error));
    }
  }

  private async exportGlb(button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    button.textContent = 'Exportando…';
    try {
      download(await this.viewer!.exportGlb(), `${this.fileBase()}.glb`);
      logActivity('Modelo exportado', `Se exportó el modelo 3D del análisis #${this.detail!.analysis.id} en GLB.`);
      Toast.success('Modelo exportado en formato GLB.');
    } catch (error) {
      Toast.error(errorMessage(error));
    } finally {
      button.disabled = false;
      button.textContent = 'Exportar GLB';
    }
  }
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
