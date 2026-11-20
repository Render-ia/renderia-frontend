import { AiAssistantService, type RenderStyle } from '../../services/AiAssistantService.ts';
import { styleFor, TYPE_ORDER } from '../../analysis/elementStyle.ts';
import { Session } from '../../auth/Session.ts';
import type { CatalogItem } from '../../models/Catalog.ts';
import { logActivity } from '../../services/ActivityLogger.ts';
import { AnalysisService, type AnalysisDetail } from '../../services/AnalysisService.ts';
import { BuildingService } from '../../services/BuildingService.ts';
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
  MAX_STORIES,
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

const RENDER_STYLES: { value: RenderStyle; label: string }[] = [
  { value: 'modern', label: 'Moderno' },
  { value: 'contemporary', label: 'Contemporáneo' },
  { value: 'minimalist', label: 'Minimalista' },
  { value: 'tropical', label: 'Tropical' },
  { value: 'rustic', label: 'Rústico' },
  { value: 'traditional', label: 'Tradicional' },
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('No se pudo leer la captura del modelo.'));
    reader.readAsDataURL(blob);
  });
}

function savedAudience(): Audience {
  if (Session.getInstance().user?.role.name === 'Cliente') return 'client';
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
  /** How many times the analyzed floor is stacked, and the floor shown on top (null = all). */
  private stories = 1;
  private shownStory: number | null = null;
  /** Building mode: one analyzed plan per floor, floor 1 first. */
  private floors: AnalysisDetail[] = [];
  /** Floor shown alone in building mode (null = the whole building). */
  private onlyStory: number | null = null;

  /** Opens one analysis, or with `projectId` the whole building of a project. */
  constructor(
    private readonly analysisId: number | null,
    private readonly projectId: number | null = null,
  ) {
    super();
  }

  /** True when the project has several analyzed floors stacked as a building. */
  private get building(): boolean {
    return this.floors.length > 1;
  }

  private get elements(): AnalysisDetail['elements'] {
    return this.floors.flatMap((floor) => floor.elements);
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
      const [floors, catalogs] = await Promise.all([
        this.projectId !== null
          ? new BuildingService().floors(this.projectId)
          : new AnalysisService().get(this.analysisId!).then((one) => [one]),
        CatalogService.getInstance().load(),
      ]);
      const detail = floors[0];
      if (detail.analysis.status !== 'COMPLETED') {
        throw new Error('Este análisis no terminó bien, así que no tiene modelo 3D. Vuelve a analizar el plano.');
      }
      this.floors = floors;
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
    const { analysis, plan, project } = this.detail!;
    const elements = this.elements;
    const canExport = Session.getInstance().can('models:export');
    const client = this.audience === 'client';

    page.innerHTML = `
      <p class="breadcrumb"><a href="#/viewer">Visor 3D</a> / ${
        this.projectId !== null
          ? `<a href="#/projects/${project.id}">Proyecto</a>`
          : `<a href="#/analyses/${analysis.id}">Análisis #${analysis.id}</a>`
      }</p>
      <header class="page-header page-header--row">
        <div>
          <h1>${this.projectId !== null ? escapeHtml(project.name) : `${escapeHtml(project.name)}, piso ${plan.floorLevel}`}</h1>
          <p class="page-header__lead">${
            client
              ? 'Presentación del proyecto. Los acabados son una propuesta visual: la geometría es la del análisis.'
              : this.building
                ? `Edificio de ${this.floors.length} pisos con ${elements.length} elementos detectados, un plano por piso.`
                : `Modelo estructural con ${elements.length} elementos detectados.`
          }</p>
        </div>
        <div class="page-header__actions">
          ${
            Session.getInstance().user?.role.name === 'Cliente'
              ? ''
              : `<div class="segmented" role="group" aria-label="Modo de la vista">
            <button type="button" class="segmented__item" data-audience="engineer" aria-pressed="${!client}">Ingeniero</button>
            <button type="button" class="segmented__item" data-audience="client" aria-pressed="${client}">Cliente</button>
          </div>`
          }
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
            <section class="viewer__card" aria-labelledby="building-title">
              <h2 id="building-title">Edificio</h2>
              ${this.building ? this.floorButtons() : this.typicalFloorControls()}
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
            <section class="viewer__card" aria-labelledby="ai-render-title" data-ai-render hidden>
              <h2 id="ai-render-title">Render con IA</h2>
              <label class="field">
                <span class="field__label">Estilo</span>
                <select class="select select--compact" data-render-style>${RENDER_STYLES.map(
                  (s) => `<option value="${s.value}">${s.label}</option>`,
                ).join('')}</select>
              </label>
              <label class="field">
                <span class="field__label">Escena</span>
                <select class="select select--compact" data-render-scene>
                  <option value="exterior">Exterior</option>
                  <option value="interior">Interior</option>
                </select>
              </label>
              <label class="field">
                <span class="field__label">Indicaciones (opcional)</span>
                <input class="input" maxlength="300" data-render-notes placeholder="Ej.: atardecer, jardín al frente" />
              </label>
              <button class="button button--small" type="button" data-render>Generar render</button>
              <small class="viewer__note" data-render-left></small>
              <div data-render-result></div>
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
    page.querySelectorAll<HTMLButtonElement>('[data-floor]').forEach((button) =>
      button.addEventListener('click', () => {
        this.onlyStory = button.dataset.floor === 'all' ? null : Number(button.dataset.floor);
        this.viewer?.showOnlyStory(this.onlyStory);
        page.querySelectorAll<HTMLButtonElement>('[data-floor]').forEach((b) => {
          const on = b === button;
          b.classList.toggle('viewer__chip--on', on);
          b.setAttribute('aria-pressed', String(on));
        });
      }),
    );
    const storiesInput = page.querySelector<HTMLInputElement>('[data-stories]');
    storiesInput?.addEventListener('input', () => {
      page.querySelector('[data-stories-value]')!.textContent = storiesInput.value;
    });
    storiesInput?.addEventListener('change', () => {
      this.stories = Number(storiesInput.value);
      if (this.shownStory !== null && this.shownStory > this.stories) this.shownStory = null;
      this.renderPageKeepingViewer(page);
      void this.rebuild();
    });
    page.querySelector<HTMLInputElement>('[data-story]')?.addEventListener('input', (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      this.shownStory = value >= this.stories ? null : value;
      page.querySelector('[data-story-value]')!.textContent = this.shownStory === null ? 'todos' : String(value);
      this.viewer?.showUpToStory(this.shownStory);
    });
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
    page.querySelector('[data-render]')?.addEventListener('click', (event) => this.aiRender(page, event.currentTarget as HTMLButtonElement));
    this.renderLegend(page);
    this.applySection(page);
    void this.showAiRender(page);
  }

  /** The AI render card only appears when the server has an image model turned on. */
  private async showAiRender(page: HTMLElement): Promise<void> {
    const ai = new AiAssistantService();
    if (!ai.available) return;
    try {
      const caps = await ai.capabilities();
      const card = page.querySelector<HTMLElement>('[data-ai-render]');
      if (!card || !caps.renders.enabled) return;
      card.hidden = false;
      card.querySelector<HTMLElement>('[data-render-left]')!.textContent = `Te quedan ${caps.remaining.render} renders hoy.`;
    } catch {
      // Without capabilities the card stays hidden.
    }
  }

  private async aiRender(page: HTMLElement, button: HTMLButtonElement): Promise<void> {
    if (!this.viewer) return;
    const card = page.querySelector<HTMLElement>('[data-ai-render]')!;
    const style = card.querySelector<HTMLSelectElement>('[data-render-style]')!.value as RenderStyle;
    const scene = card.querySelector<HTMLSelectElement>('[data-render-scene]')!.value as 'exterior' | 'interior';
    const notes = card.querySelector<HTMLInputElement>('[data-render-notes]')!.value.trim();
    const result = card.querySelector<HTMLElement>('[data-render-result]')!;
    button.disabled = true;
    button.textContent = 'Generando… (puede tardar)';
    try {
      const capture = await blobToBase64(await this.viewer.captureHighRes(1280));
      const render = await new AiAssistantService().render(this.detail!.analysis.id, capture, style, scene, notes);
      const url = `data:${render.mimeType};base64,${render.data}`;
      result.innerHTML = `
        <img class="viewer__render" src="${url}" alt="Render con IA del proyecto" />
        <p class="viewer__note">${escapeHtml(render.disclaimer)}</p>
        <a class="button button--ghost button--small" href="${url}" download="${this.fileBase()}-render-${style}.png">Descargar</a>`;
      logActivity('Render con IA', `Se generó un render ${style} del análisis #${this.detail!.analysis.id}.`);
    } catch (error) {
      Toast.error(errorMessage(error));
    } finally {
      button.disabled = false;
      button.textContent = 'Generar render';
    }
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

  /** Building mode: the whole building or one floor at a time. */
  private floorButtons(): string {
    const button = (value: string, label: string, on: boolean) =>
      `<button class="viewer__chip ${on ? 'viewer__chip--on' : ''}" type="button" data-floor="${value}" aria-pressed="${on}">${label}</button>`;
    return `
      <div class="viewer__chips" role="group" aria-label="Piso que se ve">
        ${button('all', 'Completo', this.onlyStory === null)}
        ${this.floors.map((floor, index) => button(String(index + 1), `Piso ${floor.plan.floorLevel}`, this.onlyStory === index + 1)).join('')}
      </div>
      <p class="viewer__note">Cada piso tiene su propio plano analizado. Elige uno para verlo solo.</p>`;
  }

  /** Single analysis: repeat it as a typical floor to see a tall building. */
  private typicalFloorControls(): string {
    return `
      <label class="viewer__range">
        <span>Pisos <output data-stories-value>${this.stories}</output></span>
        <input type="range" min="1" max="${MAX_STORIES}" step="1" value="${this.stories}" data-stories />
      </label>
      <label class="viewer__range" ${this.stories === 1 ? 'hidden' : ''}>
        <span>Ver hasta el piso <output data-story-value>${this.shownStory ?? 'todos'}</output></span>
        <input type="range" min="1" max="${this.stories}" step="1" value="${this.shownStory ?? this.stories}" data-story />
      </label>
      <p class="viewer__note">Repite esta planta como planta tipo para ver el edificio completo.</p>`;
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
    const builder = new StructuralSceneBuilder().withBackground();
    if (this.building) {
      builder.withFloors(
        this.floors.map((floor) => floor.elements),
        this.types,
        this.materials,
        this.colorMode,
      );
    } else {
      builder.withElements(this.detail!.elements, this.types, this.materials, this.colorMode).withStories(this.stories);
    }
    const content = builder.withGround().withLights().build();
    this.viewer.show(content, resetCamera);
    this.hidden.forEach((type) => this.viewer!.setVisible(type, false));
    if (this.building) this.viewer.showOnlyStory(this.onlyStory);
    else this.viewer.showUpToStory(this.shownStory);
    if (this.page()) this.applySection(this.page()!);
    if (resetCamera && this.view !== 'iso') this.viewer.setView(this.view, false);
  }

  private page(): HTMLElement | null {
    return this.root?.querySelector<HTMLElement>('[data-page]') ?? null;
  }

  private renderLegend(page: HTMLElement): void {
    const counts = new Map<string, number>();
    for (const element of this.elements) {
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
    const element = picked && this.elements.find((e) => e.id === picked.elementId);
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
    if (this.building) return `${slug || 'renderia'}-${this.onlyStory === null ? 'edificio' : `piso-${this.floors[this.onlyStory - 1].plan.floorLevel}`}`;
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
