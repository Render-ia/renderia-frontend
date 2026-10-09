import { statusBadge } from '../../analysis/AnalysisState.ts';
import type { AnalysisStatus } from '../../models/AiAnalysis.ts';
import { AnalysisService, type AnalysisRow } from '../../services/AnalysisService.ts';
import { emptyState, errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { formatDateTime, formatDuration } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { View } from '../View.ts';

const STATUS_FILTERS: { value: '' | AnalysisStatus; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'COMPLETED', label: 'Completados' },
  { value: 'FAILED', label: 'Fallidos' },
  { value: 'PROCESSING', label: 'Analizando' },
];

export class AnalysesView extends View {
  readonly title = 'Análisis IA';

  private rows: AnalysisRow[] = [];
  private status: '' | AnalysisStatus = '';

  protected render(): string {
    return `
      <header class="page-header page-header--row">
        <div>
          <h1>Análisis IA</h1>
          <p class="page-header__lead">Cada análisis lee un plano y guarda los elementos estructurales que encontró.</p>
        </div>
        <div class="page-header__actions">
          <a class="button" href="#/analyses/new">Nuevo análisis</a>
        </div>
      </header>
      <div class="toolbar">
        <select class="select" aria-label="Filtrar por estado" data-status>
          ${STATUS_FILTERS.map((s) => `<option value="${s.value}">${s.label}</option>`).join('')}
        </select>
      </div>
      <div data-list>${loadingState('Cargando análisis…')}</div>`;
  }

  protected afterRender(container: HTMLElement): void {
    container.querySelector<HTMLSelectElement>('[data-status]')!.addEventListener('change', (event) => {
      this.status = (event.target as HTMLSelectElement).value as '' | AnalysisStatus;
      this.renderList();
    });
    this.load();
  }

  private async load(): Promise<void> {
    const list = this.root?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;
    try {
      this.rows = await new AnalysisService().listVisible();
      this.renderList();
    } catch (error) {
      list.innerHTML = errorState(errorMessage(error));
      list.querySelector('[data-retry]')?.addEventListener('click', () => this.load());
    }
  }

  private renderList(): void {
    const list = this.root?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;

    if (this.rows.length === 0) {
      list.innerHTML = emptyState(
        'Todavía no has analizado planos',
        'Elige un plano y un modelo de IA. En segundos verás los muros, columnas y vigas que encontró.',
        '<a class="button" href="#/analyses/new">Analizar un plano</a>',
      );
      return;
    }

    const visible = this.rows.filter((row) => !this.status || row.analysis.status === this.status);
    if (visible.length === 0) {
      list.innerHTML = emptyState('Sin resultados', 'No hay análisis con ese estado.');
      return;
    }

    list.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Plano</th>
              <th>Modelo de IA</th>
              <th>Estado</th>
              <th class="num">Elementos</th>
              <th class="num">Duración</th>
              <th>Fecha</th>
              <th><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            ${visible
              .map(
                ({ analysis, plan, project, model, model3d }) => `
                <tr>
                  <td>
                    <a href="#/analyses/${analysis.id}"><strong>${escapeHtml(project.name)}</strong></a>
                    <br /><small>Piso ${plan.floorLevel} · ${escapeHtml(plan.fileName)}</small>
                  </td>
                  <td>${escapeHtml(model?.name ?? 'Modelo eliminado')}</td>
                  <td>${statusBadge(analysis.status)}</td>
                  <td class="num">${model3d?.elementCount ?? '—'}</td>
                  <td class="num">${formatDuration(analysis.durationMs)}</td>
                  <td>${formatDateTime(analysis.createdAt)}</td>
                  <td>
                    <div class="table__actions">
                      <a class="button button--ghost button--small" href="#/analyses/${analysis.id}">Ver</a>
                      ${analysis.status === 'COMPLETED' ? `<a class="button button--small" href="#/viewer/${analysis.id}">3D</a>` : ''}
                    </div>
                  </td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  }
}
