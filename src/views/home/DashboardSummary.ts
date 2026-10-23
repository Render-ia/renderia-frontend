import { statusBadge } from '../../analysis/AnalysisState.ts';
import { styleFor, TYPE_ORDER } from '../../analysis/elementStyle.ts';
import { metersPerPixel } from '../../analysis/scale.ts';
import { Session } from '../../auth/Session.ts';
import { repositories } from '../../data/dataSource.ts';
import type { ActivityLog } from '../../models/ActivityLog.ts';
import { AnalysisService, type AnalysisRow } from '../../services/AnalysisService.ts';
import { CatalogService, nameOf } from '../../services/CatalogService.ts';
import { FloorPlanService } from '../../services/FloorPlanService.ts';
import { ProjectService } from '../../services/ProjectService.ts';
import { planDrawing } from '../../ui/planDrawing.ts';
import { planOverlay } from '../../ui/planOverlay.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { formatDuration, formatRelative } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { loadImage } from '../../utils/image.ts';

interface Numbers {
  projects: number;
  plans: number;
  completed: number;
  elements: number;
}

/** Latest analysis, numbers, next step and recent work shown on the home panel. */
export class DashboardSummary {
  private readonly analyses = new AnalysisService();

  async mount(container: HTMLElement): Promise<void> {
    container.innerHTML = loadingState('Cargando tu resumen…');
    try {
      const session = Session.getInstance();
      const [projects, plans, analyses, activity] = await Promise.all([
        new ProjectService().listVisible(),
        new FloorPlanService().listVisible(),
        this.analyses.listVisible(),
        repositories()
          .activity()
          .findRecent(6, session.can('projects:view-all') ? undefined : session.user?.id),
      ]);
      const newestFirst = [...analyses].sort((a, b) => b.analysis.createdAt.localeCompare(a.analysis.createdAt));
      const completed = newestFirst.filter((a) => a.analysis.status === 'COMPLETED');
      const numbers: Numbers = {
        projects: projects.length,
        plans: plans.length,
        completed: completed.length,
        elements: completed.reduce((sum, row) => sum + (row.model3d?.elementCount ?? 0), 0),
      };
      container.innerHTML = `
        ${numbers.completed === 0 ? this.steps(numbers) : ''}
        <div class="dashboard__grid">
          <section class="blueprint" data-hero aria-label="Último análisis">
            ${completed[0] ? loadingState('Dibujando el último análisis…') : this.emptyHero()}
          </section>
          <div class="dashboard__side">
            ${this.stats(numbers)}
            <section class="dashboard__card">
              <h2>Últimos análisis</h2>
              ${this.recentAnalyses(newestFirst.slice(0, 4))}
            </section>
            <section class="dashboard__card">
              <h2>Actividad reciente</h2>
              ${this.recentActivity(activity)}
            </section>
          </div>
        </div>`;
      if (completed[0]) this.mountHero(container.querySelector<HTMLElement>('[data-hero]')!, completed[0]);
    } catch (error) {
      container.innerHTML = errorState(errorMessage(error));
      container.querySelector('[data-retry]')?.addEventListener('click', () => this.mount(container));
    }
  }

  /** Draws the latest completed analysis over its plan, in blueprint colors. */
  private async mountHero(hero: HTMLElement, row: AnalysisRow): Promise<void> {
    try {
      const [detail, catalogs, image] = await Promise.all([
        this.analyses.get(row.analysis.id),
        CatalogService.getInstance().load(),
        loadImage(row.plan.fileUrl),
      ]);
      const mpp = metersPerPixel(detail.plan.scale);
      const counts = new Map<string, number>();
      for (const element of detail.elements) {
        const type = nameOf(catalogs.elementTypes, element.elementTypeId);
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
      const legend = TYPE_ORDER.filter((type) => counts.has(type))
        .map(
          (type) => `
          <li data-type="${type}"><span class="blueprint__swatch" style="background:${styleFor(type).color}"></span>
            <span><strong>${counts.get(type)}</strong> ${styleFor(type).label.toLowerCase()}</span></li>`,
        )
        .join('');

      hero.innerHTML = `
        <header class="blueprint__header">
          <h2>${escapeHtml(detail.project.name)}, piso ${detail.plan.floorLevel}</h2>
          <p>${escapeHtml(detail.model?.name ?? 'Modelo de IA')}, ${formatDuration(detail.analysis.durationMs)}</p>
        </header>
        <figure class="blueprint__figure">
          ${planOverlay(detail.plan.fileUrl, image.naturalWidth * mpp, image.naturalHeight * mpp, detail.elements, catalogs.elementTypes)}
        </figure>
        <ul class="blueprint__legend" aria-label="Elementos detectados">${legend}</ul>
        <div class="blueprint__actions">
          <a class="button button--on-blueprint" href="#/viewer/${detail.analysis.id}">Abrir el modelo 3D</a>
          <a class="button button--ghost-blueprint" href="#/analyses/${detail.analysis.id}">Revisar elementos</a>
        </div>`;
    } catch (error) {
      hero.innerHTML = errorState(errorMessage(error), false);
    }
  }

  private emptyHero(): string {
    return `
      <header class="blueprint__header">
        <h2>Tu primer análisis aparecerá aquí</h2>
        <p>Sube el plano de un piso y la IA marcará muros, columnas, vigas, puertas y ventanas.</p>
      </header>
      <figure class="blueprint__figure">${planDrawing()}</figure>
      <div class="blueprint__actions">
        <a class="button button--on-blueprint" href="#/analyses/new">Analizar un plano</a>
      </div>`;
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
              `<a class="stats__cell" href="${href}"><strong class="stats__value">${value.toLocaleString('es-CO')}</strong><span class="stats__label">${label}</span></a>`,
          )
          .join('')}
      </div>`;
  }

  /** The four steps of the workflow, shown until the first analysis is done. */
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
          <a href="#/analyses/${analysis.id}">${escapeHtml(project.name)}, piso ${plan.floorLevel}</a>
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
