import { AnalysisService, type AnalysisRow } from '../../services/AnalysisService.ts';
import { emptyState, errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { formatDateTime, plural } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { View } from '../View.ts';

/** List of finished analyses to open in the 3D viewer. */
export class ModelPickerView extends View {
  readonly title = 'Visor 3D';

  protected render(): string {
    return `
      <header class="page-header">
        <h1>Visor 3D</h1>
        <p class="page-header__lead">Elige un análisis terminado para recorrer su modelo estructural.</p>
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
      const rows = (await new AnalysisService().listVisible()).filter((r) => r.analysis.status === 'COMPLETED');
      if (!this.root) return;
      list.innerHTML =
        rows.length === 0
          ? emptyState(
              'Aún no hay modelos 3D',
              'Cada análisis completado genera un modelo. Analiza un plano para ver el primero.',
              '<a class="button" href="#/analyses/new">Analizar un plano</a>',
            )
          : `<div class="plan-grid plan-grid--wide">${rows.map((row) => this.card(row)).join('')}</div>`;
    } catch (error) {
      list.innerHTML = errorState(errorMessage(error));
      list.querySelector('[data-retry]')?.addEventListener('click', () => this.load());
    }
  }

  private card({ analysis, plan, project, model, model3d }: AnalysisRow): string {
    return `
      <a class="plan-card plan-card--link" href="#/viewer/${analysis.id}">
        <div class="plan-card__image"><img src="${escapeHtml(plan.fileUrl)}" alt="" loading="lazy" /></div>
        <div class="plan-card__body">
          <h3>${escapeHtml(project.name)} · Piso ${plan.floorLevel}</h3>
          <p class="plan-card__meta">${plural(model3d?.elementCount ?? 0, 'elemento', 'elementos')} · ${escapeHtml(model?.name ?? '')}</p>
          <p class="plan-card__meta">${formatDateTime(analysis.createdAt)}</p>
        </div>
      </a>`;
  }
}
