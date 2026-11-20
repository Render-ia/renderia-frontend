import { AnalysisService, type AnalysisRow } from '../../services/AnalysisService.ts';
import { CatalogService } from '../../services/CatalogService.ts';
import { emptyState, errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { plural } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { View } from '../View.ts';

/** One finished model: the newest completed analysis of a plan. */
interface ModelCard {
  row: AnalysisRow;
  buildingType: string;
  size: string | null;
  counts: string;
}

const ALL = 'Todos';

/**
 * Gallery of finished 3D models. Each card shows the plan, the kind of building
 * and what was detected, and the filters group them by building type, so it is
 * clear that a house, a school or a health center give different models.
 */
export class ModelPickerView extends View {
  readonly title = 'Visor 3D';
  private cards: ModelCard[] = [];
  private filter = ALL;

  protected render(): string {
    return `
      <header class="page-header">
        <h1>Visor 3D</h1>
        <p class="page-header__lead">Elige el proyecto que quieres ver en 3D. Cada tarjeta es un plano ya analizado.</p>
      </header>
      <div data-list>${loadingState('Buscando modelos…')}</div>`;
  }

  protected afterRender(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const list = this.root?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;
    try {
      const [rows, catalogs] = await Promise.all([
        new AnalysisService().listVisible(),
        CatalogService.getInstance().load(),
      ]);
      if (!this.root) return;
      const typeName = new Map(catalogs.buildingTypes.map((t) => [t.id, t.name]));
      this.cards = newestPerPlan(rows.filter((r) => r.analysis.status === 'COMPLETED')).map((row) => ({
        row,
        buildingType: (row.project.buildingTypeId !== null && typeName.get(row.project.buildingTypeId)) || 'Sin tipo',
        ...describe(row),
      }));
      this.paint();
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
        'Cada análisis completado genera un modelo. Analiza un plano para ver el primero.',
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
          ? `<div class="model-filters" role="group" aria-label="Filtrar por tipo de edificación">
              ${filterButton(ALL, this.cards.length)}
              ${types.map((t) => filterButton(t, this.cards.filter((c) => c.buildingType === t).length)).join('')}
            </div>`
          : ''
      }
      <div class="model-grid">${shown.map((card) => this.card(card)).join('')}</div>`;

    list.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) =>
      button.addEventListener('click', () => {
        this.filter = button.dataset.filter ?? ALL;
        this.paint();
      }),
    );
  }

  private card({ row, buildingType, size, counts }: ModelCard): string {
    const { analysis, plan, project } = row;
    return `
      <a class="model-card" href="#/viewer/${analysis.id}" aria-label="Ver ${escapeHtml(project.name)} en 3D">
        <div class="model-card__image cyanotype-frame">
          <img src="${escapeHtml(plan.fileUrl)}" alt="" loading="lazy" />
          <span class="model-card__type">${escapeHtml(buildingType)}</span>
        </div>
        <div class="model-card__body">
          <h3>${escapeHtml(project.name)}</h3>
          <p class="model-card__meta">${escapeHtml(project.location || 'Sin ubicación')} · Piso ${plan.floorLevel}${size ? ` · ${size}` : ''}</p>
          <p class="model-card__counts">${counts}</p>
          <span class="model-card__open">Ver en 3D</span>
        </div>
      </a>`;
  }
}

/** Several analyses of the same plan would look identical: keep the newest one. */
function newestPerPlan(rows: AnalysisRow[]): AnalysisRow[] {
  const byPlan = new Map<number, AnalysisRow>();
  for (const row of rows) {
    const kept = byPlan.get(row.plan.id);
    if (!kept || row.analysis.createdAt > kept.analysis.createdAt) byPlan.set(row.plan.id, row);
  }
  return [...byPlan.values()].sort((a, b) => b.analysis.createdAt.localeCompare(a.analysis.createdAt));
}

/** Size and element counts from the analysis summary, when the analyzer reported them. */
function describe(row: AnalysisRow): { size: string | null; counts: string } {
  let summary: Record<string, unknown> = {};
  try {
    summary = row.analysis.rawResponse ? (JSON.parse(row.analysis.rawResponse) as Record<string, unknown>) : {};
  } catch {
    summary = {};
  }
  const sizeM = summary.buildingSizeM as { width?: number; depth?: number } | undefined;
  const size =
    sizeM && typeof sizeM.width === 'number' && typeof sizeM.depth === 'number'
      ? `${formatMeters(sizeM.width)} × ${formatMeters(sizeM.depth)} m`
      : null;
  const c = summary.counts as Record<string, number> | undefined;
  const counts =
    c && typeof c.walls === 'number'
      ? [plural(c.walls, 'muro', 'muros'), plural(c.columns ?? 0, 'columna', 'columnas'), plural(c.doors ?? 0, 'puerta', 'puertas')].join(' · ')
      : plural(row.model3d?.elementCount ?? 0, 'elemento', 'elementos');
  return { size, counts };
}

function formatMeters(value: number): string {
  return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}
