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
import {
  DISCIPLINES,
  disciplineOf,
  FINISHES,
  isFinish,
  TECHNICAL_MODES,
  VIEWS,
  colorFor,
  type ColorMode,
  type ViewName,
} from '../../viewer/studio.ts';
import { View } from '../View.ts';

/** Who the screen is for: the engineer sees the technical data, the client a clean presentation. */
type Audience = 'engineer' | 'client';

const AUDIENCE_KEY = 'renderia.viewer.audience';

/** Highest cut that still leaves the model whole. */
const MAX_CUT_HEIGHT = 3.2;

function savedAudience(): Audience {
  try {
    return localStorage.getItem(AUDIENCE_KEY) === 'client' ? 'client' : 'engineer';
  } catch {
    return 'engineer';
  }
}

/**
 * 3D studio of one analysis: standard views, layers by discipline, section
 * cuts, finish styles, a presentation tour and 4K captures. Three.js is
 * loaded only when this screen opens.
 */
export class ViewerView extends View {
  title = 'Visor 3D';

  private viewer: ModelViewer | null = null;
  private detail: AnalysisDetail | null = null;
  private types: CatalogItem[] = [];
  private materials: CatalogItem[] = [];
  private audience: Audience = savedAudience();
  private colorMode: ColorMode = this.audience === 'client' ? 'modern' : 'model';
  private hidden = new Set<string>();
  private view: ViewName = 'iso';
  private cutHeight = MAX_CUT_HEIGHT;
  /** Vertical cut position from 0 (front) to 1 (back); 1 is off. */
  private cutDepth = 1;

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
    const client = this.audience === 'client';

    page.innerHTML = `
      <p class="breadcrumb"><a href="#/viewer">Visor 3D</a> / <a href="#/analyses/${analysis.id}">Análisis #${analysis.id}</a></p>
      <header class="page-header page-header--row">
        <div>
          <h1>${escapeHtml(project.name)}, piso ${plan.floorLevel}</h1>
          <p class="page-header__lead">${
            client
              ? 'Presentación del proyecto. Los acabados son una propuesta visual: la geometría es la del análisis.'
              : `Modelo estructural con ${elements.length} elementos detectados.`
          }</p>
        </div>
        <div class="page-header__actions">
          <div class="segmented" role="group" aria-label="Modo de la vista">
            <button type="button" class="segmented__item" data-audience="engineer" aria-pressed="${!client}">Ingeniero</button>
            <button type="button" class="segmented__item" data-audience="client" aria-pressed="${client}">Cliente</button>
          </div>
          <button class="button button--ghost" type="button" data-shot>Imagen 4K</button>
          ${
            canExport && !client
              ? '<button class="button" type="button" data-export>Exportar GLB</button>'
              : ''
          }
        </div>
      </header>

      <div class="viewer ${client ? 'viewer--client' : ''}">
        <div class="viewer__stage" data-stage>
          <div class="viewer__toolbar" role="toolbar" aria-label="Controles de la vista">
            ${VIEWS.map(
              (v) =>
                `<button class="viewer__tool ${this.view === v.name ? 'viewer__tool--on' : ''}" type="button" data-view="${v.name}" aria-pressed="${this.view === v.name}">${v.label}</button>`,
            ).join('')}
            <span class="viewer__divider"></span>
            <button class="viewer__tool" type="button" data-tour aria-pressed="false">Recorrido</button>
          </div>
          <div class="viewer__panel">
            <section class="viewer__card" aria-labelledby="style-title">
              <h2 id="style-title">${client ? 'Acabados' : 'Color'}</h2>
              <div class="viewer__chips" role="group" aria-label="${client ? 'Acabados' : 'Color del modelo'}">
                ${(client ? FINISHES : [...TECHNICAL_MODES, ...FINISHES]).map((m) => this.colorButton(m.mode, m.label)).join('')}
              </div>
              ${isFinish(this.colorMode) ? '<p class="viewer__note">Solo cambian los colores; las medidas no se tocan.</p>' : ''}
            </section>
            <section class="viewer__card" aria-labelledby="layers-title">
              <h2 id="layers-title">Capas</h2>
              <div data-legend></div>
            </section>
            <section class="viewer__card" aria-labelledby="section-title">
              <h2 id="section-title">Corte</h2>
              <label class="viewer__range">
                <span>Altura <output data-cut-height-value></output></span>
                <input type="range" min="0.3" max="${MAX_CUT_HEIGHT}" step="0.05" value="${this.cutHeight}" data-cut-height />
              </label>
              <label class="viewer__range">
                <span>Fachada a fondo <output data-cut-depth-value></output></span>
                <input type="range" min="0.02" max="1" step="0.01" value="${this.cutDepth}" data-cut-depth />
              </label>
            </section>
            <div class="viewer__card viewer__info" data-info hidden></div>
          </div>
          <p class="viewer__help">Arrastra para girar. Rueda para acercar. Clic derecho para mover. Clic en un elemento para ver sus datos.</p>
        </div>
      </div>`;

    page.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) =>
      button.addEventListener('click', () => {
        this.view = button.dataset.view as ViewName;
        this.setTour(page, false);
        this.viewer?.setView(this.view);
        page.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
          const on = b === button;
          b.classList.toggle('viewer__tool--on', on);
          b.setAttribute('aria-pressed', String(on));
        });
      }),
    );
    page.querySelector('[data-tour]')!.addEventListener('click', () => this.setTour(page, !this.viewer?.touring));
    page.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((button) =>
      button.addEventListener('click', () => {
        this.colorMode = button.dataset.color as ColorMode;
        this.renderPageKeepingViewer(page);
      }),
    );
    page.querySelectorAll<HTMLButtonElement>('[data-audience]').forEach((button) =>
      button.addEventListener('click', () => this.setAudience(page, button.dataset.audience as Audience)),
    );
    page.querySelector<HTMLInputElement>('[data-cut-height]')!.addEventListener('input', (event) => {
      this.cutHeight = Number((event.target as HTMLInputElement).value);
      this.applySection(page);
    });
    page.querySelector<HTMLInputElement>('[data-cut-depth]')!.addEventListener('input', (event) => {
      this.cutDepth = Number((event.target as HTMLInputElement).value);
      this.applySection(page);
    });
    page.querySelector('[data-shot]')!.addEventListener('click', (event) => this.downloadImage(event.currentTarget as HTMLButtonElement));
    page.querySelector('[data-export]')?.addEventListener('click', (event) => this.exportGlb(event.currentTarget as HTMLButtonElement));
    this.renderLegend(page);
    this.applySection(page);
  }

  /** Re-renders the controls but keeps the same 3D canvas and camera. */
  private renderPageKeepingViewer(page: HTMLElement): void {
    this.renderPage(page);
    this.viewer?.attachTo(page.querySelector<HTMLElement>('[data-stage]')!);
    this.rebuild(false);
  }

  private setAudience(page: HTMLElement, audience: Audience): void {
    if (audience === this.audience) return;
    this.audience = audience;
    try {
      localStorage.setItem(AUDIENCE_KEY, audience);
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
    if (audience === 'client' && !isFinish(this.colorMode)) this.colorMode = 'modern';
    if (audience === 'engineer' && isFinish(this.colorMode)) this.colorMode = 'model';
    this.renderPageKeepingViewer(page);
  }

  private setTour(page: HTMLElement, on: boolean): void {
    this.viewer?.setTour(on);
    const button = page.querySelector<HTMLButtonElement>('[data-tour]');
    button?.classList.toggle('viewer__tool--on', on);
    button?.setAttribute('aria-pressed', String(on));
  }

  private applySection(page: HTMLElement): void {
    const heightOn = this.cutHeight < MAX_CUT_HEIGHT;
    const depthOn = this.cutDepth < 1;
    page.querySelector('[data-cut-height-value]')!.textContent = heightOn ? formatMeters(this.cutHeight) : 'sin corte';
    page.querySelector('[data-cut-depth-value]')!.textContent = depthOn ? `${Math.round(this.cutDepth * 100)} %` : 'sin corte';
    if (!this.viewer) return;
    const { depth } = this.viewer.size;
    this.viewer.setSection({
      height: heightOn ? this.cutHeight : null,
      // From the front facade (+z) towards the back (-z).
      depth: depthOn ? depth / 2 - this.cutDepth * depth : null,
    });
  }

  private colorButton(mode: ColorMode, label: string): string {
    const on = this.colorMode === mode;
    return `<button class="viewer__chip ${on ? 'viewer__chip--on' : ''}" type="button" data-color="${mode}" aria-pressed="${on}">
        <span class="viewer__chip-swatch" style="background:${colorFor(mode, 'Muro', 'Ladrillo')}"></span>${label}</button>`;
  }

  private async mountViewer(page: HTMLElement): Promise<void> {
    const stage = page.querySelector<HTMLElement>('[data-stage]')!;
    const { ModelViewer } = await import('../../viewer/ModelViewer.ts');
    if (!this.root) return;
    this.viewer = new ModelViewer(stage, (picked) => this.showInfo(page, picked));
    await this.rebuild();
  }

  private async rebuild(resetCamera = true): Promise<void> {
    if (!this.viewer) return;
    const { StructuralSceneBuilder } = await import('../../viewer/StructuralSceneBuilder.ts');
    const content = new StructuralSceneBuilder()
      .withBackground()
      .withElements(this.detail!.elements, this.types, this.materials, this.colorMode)
      .withGround()
      .withLights()
      .build();
    this.viewer.show(content, resetCamera);
    this.hidden.forEach((type) => this.viewer!.setVisible(type, false));
    if (this.page()) this.applySection(this.page()!);
    if (resetCamera && this.view !== 'iso') this.viewer.setView(this.view, false);
  }

  private page(): HTMLElement | null {
    return this.root?.querySelector<HTMLElement>('[data-page]') ?? null;
  }

  private renderLegend(page: HTMLElement): void {
    const counts = new Map<string, number>();
    for (const element of this.detail!.elements) {
      const type = nameOf(this.types, element.elementTypeId, 'Otro');
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const ordered = [...TYPE_ORDER.filter((t) => counts.has(t)), ...[...counts.keys()].filter((t) => !TYPE_ORDER.includes(t as never))];
    const client = this.audience === 'client';

    const legend = page.querySelector<HTMLElement>('[data-legend]')!;
    legend.innerHTML = DISCIPLINES.map((discipline) => {
      const types = ordered.filter((t) => disciplineOf(t) === discipline.id);
      if (types.length === 0) return '';
      const shown = types.filter((t) => !this.hidden.has(t)).length;
      const total = types.reduce((sum, t) => sum + counts.get(t)!, 0);
      const children = client
        ? ''
        : `<ul class="legend__list legend__list--nested">${types
            .map(
              (type) => `
                <li>
                  <label class="legend__item">
                    <input type="checkbox" data-type="${escapeHtml(type)}" ${this.hidden.has(type) ? '' : 'checked'} />
                    ${this.swatch(type)}
                    <span class="legend__name">${escapeHtml(type)}</span>
                    <span class="legend__count">${counts.get(type)}</span>
                  </label>
                </li>`,
            )
            .join('')}</ul>`;
      return `
        <div class="legend__group">
          <label class="legend__item legend__item--group">
            <input type="checkbox" data-discipline="${discipline.id}" ${shown > 0 ? 'checked' : ''} />
            <span class="legend__name">${discipline.label}</span>
            <span class="legend__count">${total}</span>
          </label>
          ${children}
        </div>`;
    }).join('');

    legend.querySelectorAll<HTMLInputElement>('[data-discipline]').forEach((box) => {
      const types = ordered.filter((t) => disciplineOf(t) === box.dataset.discipline);
      const shown = types.filter((t) => !this.hidden.has(t)).length;
      box.indeterminate = shown > 0 && shown < types.length;
      box.addEventListener('change', () => {
        types.forEach((type) => this.setTypeVisible(type, box.checked));
        this.renderLegend(page);
      });
    });
    legend.querySelectorAll<HTMLInputElement>('[data-type]').forEach((box) =>
      box.addEventListener('change', () => {
        this.setTypeVisible(box.dataset.type!, box.checked);
        this.renderLegend(page);
      }),
    );
  }

  private setTypeVisible(type: string, visible: boolean): void {
    if (visible) this.hidden.delete(type);
    else this.hidden.add(type);
    this.viewer?.setVisible(type, visible);
  }

  /** Color sample next to a layer; colors by material vary inside a layer, so they get none. */
  private swatch(type: string): string {
    if (this.colorMode === 'material') return '';
    return `<span class="legend__swatch" style="background:${colorFor(this.colorMode, type, null)}"></span>`;
  }

  private showInfo(page: HTMLElement, picked: PickedElement | null): void {
    const info = page.querySelector<HTMLElement>('[data-info]')!;
    const element = picked && this.detail!.elements.find((e) => e.id === picked.elementId);
    if (!picked || !element) {
      info.hidden = true;
      return;
    }
    const client = this.audience === 'client';
    const rows: [string, string][] = [['Material', picked.materialName || 'Sin material']];
    if (!client) rows.push(['Confianza de la IA', formatPercent(element.confidence)]);
    if (element.endX !== null && element.endY !== null && picked.typeName !== 'Losa') {
      rows.push(['Largo', formatMeters(Math.hypot(element.endX - element.startX, element.endY - element.startY))]);
    }
    if (element.width !== null) rows.push(['Ancho', formatMeters(element.width)]);
    if (element.thickness !== null) rows.push(['Espesor', formatMeters(element.thickness)]);
    if (element.height !== null) rows.push(['Alto', formatMeters(element.height)]);

    info.innerHTML = `
      <h3><span class="legend__swatch" style="background:${styleFor(picked.typeName).color}"></span> ${escapeHtml(picked.typeName)}${client ? '' : ` #${element.id}`}</h3>
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

  private async downloadImage(button: HTMLButtonElement): Promise<void> {
    if (!this.viewer) return;
    button.disabled = true;
    button.textContent = 'Generando…';
    try {
      download(await this.viewer.captureHighRes(), `${this.fileBase()}-${this.view}.png`);
      Toast.success('Imagen 4K descargada.');
    } catch (error) {
      Toast.error(errorMessage(error));
    } finally {
      button.disabled = false;
      button.textContent = 'Imagen 4K';
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
