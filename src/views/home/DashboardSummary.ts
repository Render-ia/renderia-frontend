import { statusBadge } from '../../analysis/AnalysisState.ts';
import { Session } from '../../auth/Session.ts';
import { repositories } from '../../data/dataSource.ts';
import type { ActivityLog } from '../../models/ActivityLog.ts';
import { AnalysisService, type AnalysisRow } from '../../services/AnalysisService.ts';
import { FloorPlanService } from '../../services/FloorPlanService.ts';
import { ProjectService } from '../../services/ProjectService.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { formatRelative } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';

interface Numbers {
  projects: number;
  plans: number;
  completed: number;
  elements: number;
}

/** Numbers, next step and recent work shown on the home panel. */
export class DashboardSummary {
  async mount(container: HTMLElement): Promise<void> {
    container.innerHTML = loadingState('Cargando tu resumen…');
    try {
      const session = Session.getInstance();
      const [projects, plans, analyses, activity] = await Promise.all([
        new ProjectService().listVisible(),
        new FloorPlanService().listVisible(),
        new AnalysisService().listVisible(),
        repositories()
          .activity()
          .findRecent(8, session.can('projects:view-all') ? undefined : session.user?.id),
      ]);
      const completed = analyses.filter((a) => a.analysis.status === 'COMPLETED');
      const numbers: Numbers = {
        projects: projects.length,
        plans: plans.length,
        completed: completed.length,
        elements: completed.reduce((sum, row) => sum + (row.model3d?.elementCount ?? 0), 0),
      };
      container.innerHTML = `
        ${this.stats(numbers)}
        ${this.steps(numbers)}
        <div class="dashboard__columns">
          <section class="dashboard__card">
            <h2>Últimos análisis</h2>
            ${this.recentAnalyses(analyses.slice(0, 5))}
          </section>
          <section class="dashboard__card">
            <h2>Actividad reciente</h2>
            ${this.recentActivity(activity)}
          </section>
        </div>`;
    } catch (error) {
      container.innerHTML = errorState(errorMessage(error));
      container.querySelector('[data-retry]')?.addEventListener('click', () => this.mount(container));
    }
  }

  private stats(n: Numbers): string {
    const cells: [string, number, string][] = [
      ['Proyectos', n.projects, '#/projects'],
      ['Planos', n.plans, '#/floor-plans'],
      ['Análisis completados', n.completed, '#/analyses'],
      ['Elementos detectados', n.elements, '#/viewer'],
    ];
    return `
      <div class="stats">
        ${cells
          .map(
            ([label, value, href]) =>
              `<a class="stats__cell" href="${href}"><span class="stats__label">${label}</span><strong class="stats__value">${value.toLocaleString('es-CO')}</strong></a>`,
          )
          .join('')}
      </div>`;
  }

  /** The four steps of the workflow, marking the ones already done. */
  private steps(n: Numbers): string {
    const steps = [
      { done: n.projects > 0, title: 'Crea un proyecto', href: '#/projects' },
      { done: n.plans > 0, title: 'Sube el plano de cada piso', href: '#/projects' },
      { done: n.completed > 0, title: 'Analízalo con IA', href: '#/analyses/new' },
      { done: n.completed > 0, title: 'Recorre el modelo 3D', href: '#/viewer' },
    ];
    const next = steps.findIndex((s) => !s.done);
    return `
      <ol class="steps" aria-label="Cómo funciona">
        ${steps
          .map(
            (step, index) => `
            <li class="steps__item ${step.done ? 'steps__item--done' : ''} ${index === next ? 'steps__item--next' : ''}">
              <span class="steps__number">${index + 1}</span>
              <a href="${step.href}">${step.title}</a>
            </li>`,
          )
          .join('')}
      </ol>`;
  }

  private recentAnalyses(rows: AnalysisRow[]): string {
    if (rows.length === 0) {
      return '<p class="field__hint">Cuando analices un plano aparecerá aquí.</p>';
    }
    return `<ul class="feed">${rows
      .map(
        ({ analysis, plan, project }) => `
        <li>
          <a href="#/analyses/${analysis.id}">${escapeHtml(project.name)} · Piso ${plan.floorLevel}</a>
          ${statusBadge(analysis.status)}
          <small>${formatRelative(analysis.createdAt)}</small>
        </li>`,
      )
      .join('')}</ul>`;
  }

  private recentActivity(logs: ActivityLog[]): string {
    if (logs.length === 0) {
      return '<p class="field__hint">Aún no hay actividad.</p>';
    }
    return `<ul class="feed">${logs
      .map(
        (log) => `
        <li>
          <span><strong>${escapeHtml(log.action)}.</strong> ${escapeHtml(log.details)}</span>
          <small>${formatRelative(log.createdAt)}</small>
        </li>`,
      )
      .join('')}</ul>`;
  }
}
