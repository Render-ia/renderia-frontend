import type { Catalogs } from '../../services/CatalogService.ts';
import { AnalysisService } from '../../services/AnalysisService.ts';
import { buildingsOf, type Building } from '../../services/BuildingService.ts';
import { CatalogService } from '../../services/CatalogService.ts';
import { emptyState, errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { plural } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { View } from '../View.ts';

const ALL = 'Todos';
/** Bump when the cover look changes so old pictures are drawn again. */
const COVER_KEY = 'renderia.cover.v3';

interface Card {
  building: Building;
  buildingType: string;
  elements: number;
  coverKey: string;
}

/**
 * Gallery of buildings to open in 3D. Each card shows the finished building
 * (drawn in the browser from its analyses and kept for the next visit), its
 * kind and how many floors it has; the filters group the cards by kind.
 */
export class ModelPickerView extends View {
  readonly title = 'Visor 3D';
  private cards: Card[] = [];
  private catalogs: Catalogs | null = null;
  private filter = ALL;
  private drawing = false;

  protected render(): string {
    return `
      <header class="page-header">
        <h1>Visor 3D</h1>
        <p class="page-header__lead">Elige un proyecto para recorrerlo en 3D, completo o piso por piso.</p>
      </header>
      <div data-list>${loadingState('Buscando proyectos…')}</div>`;
  }

  protected afterRender(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const list = this.root?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;
    try {
      const [rows, catalogs] = await Promise.all([new AnalysisService().listVisible(), CatalogService.getInstance().load()]);
      if (!this.root) return;
      this.catalogs = catalogs;
      const typeName = new Map(catalogs.buildingTypes.map((t) => [t.id, t.name]));
      this.cards = buildingsOf(rows).map((building) => {
        const project = building.floors[0].project;
        return {
          building,
          buildingType: (project.buildingTypeId !== null && typeName.get(project.buildingTypeId)) || 'Sin tipo',
          elements: building.floors.reduce((sum, row) => sum + (row.model3d?.elementCount ?? 0), 0),
          coverKey: `${COVER_KEY}.${building.projectId}.${building.floors.map((r) => r.analysis.id).join('-')}`,
        };
      });
      this.paint();
      void this.drawCovers();
    } catch (error) {
      list.innerHTML = errorState(errorMessage(error));
      list.querySelector('[data-retry]')?.addEventListener('click', () => this.load());
    }
  }

  private paint(): void {
    const list = this.root?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;
    if (this.cards.length === 0) {
      list.innerHTML = emptyState(
        'Aún no hay modelos 3D',
        'Cada plano analizado se convierte en un modelo. Analiza un plano para ver el primero.',
        '<a class="button" href="#/analyses/new">Analizar un plano</a>',
      );
      return;
    }
    const types = [...new Set(this.cards.map((c) => c.buildingType))].sort((a, b) => a.localeCompare(b, 'es'));
    if (!types.includes(this.filter)) this.filter = ALL;
    const shown = this.filter === ALL ? this.cards : this.cards.filter((c) => c.buildingType === this.filter);
    const filterButton = (name: string, count: number) =>
      `<button type="button" class="chip" data-filter="${escapeHtml(name)}" aria-pressed="${this.filter === name}">${escapeHtml(name)} <span class="chip__count">${count}</span></button>`;

    list.innerHTML = `
      ${
        types.length > 1
          ? `<div class="building-filters" role="group" aria-label="Filtrar por tipo de edificación">
              ${filterButton(ALL, this.cards.length)}
              ${types.map((t) => filterButton(t, this.cards.filter((c) => c.buildingType === t).length)).join('')}
            </div>`
          : ''
      }
      <div class="building-grid">${shown.map((card) => this.card(card)).join('')}</div>`;

    list.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) =>
      button.addEventListener('click', () => {
        this.filter = button.dataset.filter ?? ALL;
        this.paint();
        void this.drawCovers();
      }),
    );
  }

  private card({ building, buildingType, elements, coverKey }: Card): string {
    const { project, plan } = building.floors[0];
    const floors = building.floors.length;
    const cover = readCover(coverKey);
    return `
      <a class="building-card" href="#/viewer/project/${building.projectId}" aria-label="Ver ${escapeHtml(project.name)} en 3D">
        <div class="building-card__image ${cover ? '' : 'building-card__image--pending'}" data-cover="${escapeHtml(coverKey)}">
          <img src="${escapeHtml(cover ?? plan.fileUrl)}" alt="" loading="lazy" />
          <span class="building-card__type">${escapeHtml(buildingType)}</span>
        </div>
        <div class="building-card__body">
          <h3>${escapeHtml(project.name)}</h3>
          <p class="building-card__meta">${escapeHtml(project.location || 'Sin ubicación')}</p>
          <p class="building-card__meta"><strong>${plural(floors, 'piso', 'pisos')}</strong> · ${plural(elements, 'elemento', 'elementos')}</p>
        </div>
      </a>`;
  }

  /** Draws the missing covers one by one, so the page stays responsive. */
  private async drawCovers(): Promise<void> {
    if (this.drawing || !this.catalogs) return;
    this.drawing = true;
    try {
      const { renderCover } = await import('../../viewer/coverRenderer.ts');
      const analyses = new AnalysisService();
      for (const card of this.cards) {
        if (!this.root) return;
        if (readCover(card.coverKey)) continue;
        try {
          const details = await Promise.all(card.building.floors.map((row) => analyses.get(row.analysis.id)));
          const picture = renderCover(
            details.map((d) => d.elements),
            this.catalogs.elementTypes,
            this.catalogs.materials,
          );
          saveCover(card.coverKey, picture);
          const frame = this.root?.querySelector<HTMLElement>(`[data-cover="${CSS.escape(card.coverKey)}"]`);
          frame?.classList.remove('building-card__image--pending');
          frame?.querySelector('img')?.setAttribute('src', picture);
        } catch {
          // Without WebGL or with a broken analysis the card keeps the plan picture.
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      this.drawing = false;
    }
  }
}

function readCover(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveCover(key: string, picture: string): void {
  try {
    // Old pictures of the same project (before a new analysis) are replaced.
    const prefix = key.split('.').slice(0, 4).join('.') + '.';
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const old = localStorage.key(i);
      if (old && old.startsWith(prefix) && old !== key) localStorage.removeItem(old);
    }
    localStorage.setItem(key, picture);
  } catch {
    // Storage full or blocked: the cover is drawn again next time.
  }
}
