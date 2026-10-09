import { statusBadge } from '../../analysis/AnalysisState.ts';
import { repositories } from '../../data/dataSource.ts';
import type { AiAnalysis } from '../../models/AiAnalysis.ts';
import type { FloorPlan } from '../../models/FloorPlan.ts';
import type { Project } from '../../models/Project.ts';
import { FloorPlanService } from '../../services/FloorPlanService.ts';
import { emptyState, errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { formatDate } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { View } from '../View.ts';

/** Every floor plan the user can see, across projects. */
export class FloorPlansView extends View {
  readonly title = 'Planos';

  private items: { plan: FloorPlan; project: Project }[] = [];
  private analyses: AiAnalysis[] = [];
  private projectFilter = '';

  protected render(): string {
    return `
      <header class="page-header">
        <h1>Planos</h1>
        <p class="page-header__lead">Todos los planos de tus proyectos. Para subir uno nuevo, entra al proyecto.</p>
      </header>
      <div class="toolbar">
        <select class="select" aria-label="Filtrar por proyecto" data-project>
          <option value="">Todos los proyectos</option>
        </select>
      </div>
      <div data-list>${loadingState('Cargando planos…')}</div>`;
  }

  protected afterRender(container: HTMLElement): void {
    container.querySelector<HTMLSelectElement>('[data-project]')!.addEventListener('change', (event) => {
      this.projectFilter = (event.target as HTMLSelectElement).value;
      this.renderList();
    });
    this.load();
  }

  private async load(): Promise<void> {
    const list = this.root?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;
    try {
      [this.items, this.analyses] = await Promise.all([
        new FloorPlanService().listVisible(),
        repositories().analyses().findAll(),
      ]);
      if (!this.root) return;
      const projects = new Map(this.items.map(({ project }) => [project.id, project]));
      this.root.querySelector('[data-project]')!.insertAdjacentHTML(
        'beforeend',
        [...projects.values()].map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join(''),
      );
      this.renderList();
    } catch (error) {
      list.innerHTML = errorState(errorMessage(error));
      list.querySelector('[data-retry]')?.addEventListener('click', () => this.load());
    }
  }

  private renderList(): void {
    const list = this.root?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;

    if (this.items.length === 0) {
      list.innerHTML = emptyState(
        'Aún no hay planos',
        'Abre un proyecto y sube el plano de planta de cada piso.',
        '<a class="button" href="#/projects">Ir a proyectos</a>',
      );
      return;
    }

    const visible = this.items.filter(({ project }) => !this.projectFilter || String(project.id) === this.projectFilter);
    list.innerHTML = `<div class="plan-grid plan-grid--wide">${visible
      .map(({ plan, project }) => {
        const latest = this.analyses.find((a) => a.floorPlanId === plan.id);
        return `
          <article class="plan-card">
            <div class="plan-card__image"><img src="${escapeHtml(plan.fileUrl)}" alt="" loading="lazy" /></div>
            <div class="plan-card__body">
              <h3><a href="#/projects/${project.id}">${escapeHtml(project.name)}</a> · Piso ${plan.floorLevel}</h3>
              <p class="plan-card__meta">Escala ${escapeHtml(plan.scale)} · Subido el ${formatDate(plan.uploadedAt)}</p>
              <p class="plan-card__status">${latest ? statusBadge(latest.status) : '<span class="badge badge--neutral">Sin analizar</span>'}</p>
              <div class="plan-card__actions">
                <a class="button button--small" href="#/analyses/new/${plan.id}">Analizar con IA</a>
                ${latest ? `<a class="button button--ghost button--small" href="#/analyses/${latest.id}">Último análisis</a>` : ''}
              </div>
            </div>
          </article>`;
      })
      .join('')}</div>`;
  }
}
