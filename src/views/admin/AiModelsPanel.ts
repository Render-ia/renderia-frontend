import { AnalyzerFactory } from '../../analysis/AnalyzerFactory.ts';
import { repositories } from '../../data/dataSource.ts';
import type { AiModel } from '../../models/Catalog.ts';
import { logActivity } from '../../services/ActivityLogger.ts';
import { CatalogService } from '../../services/CatalogService.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { escapeHtml } from '../../utils/html.ts';
import type { AdminPanel } from './AdminPanel.ts';

/** Turn AI models on or off and choose the default one. */
export class AiModelsPanel implements AdminPanel {
  readonly id = 'models';
  readonly label = 'Modelos de IA';

  private readonly repo = repositories().catalogs();

  mount(container: HTMLElement): void {
    container.innerHTML = loadingState('Cargando modelos…');
    this.load(container);
  }

  private async load(container: HTMLElement): Promise<void> {
    try {
      this.render(container, await this.repo.listAiModels());
    } catch (error) {
      container.innerHTML = errorState(errorMessage(error));
      container.querySelector('[data-retry]')?.addEventListener('click', () => this.mount(container));
    }
  }

  private render(container: HTMLElement, models: AiModel[]): void {
    container.innerHTML = `
      <div class="model-list">
        ${models
          .map(
            (model) => `
            <article class="model-card ${model.isActive ? '' : 'model-card--off'}" data-model="${model.id}">
              <div class="model-card__head">
                <h3>${escapeHtml(model.name)}</h3>
                ${model.isDefault ? '<span class="badge badge--info">Predeterminado</span>' : ''}
              </div>
              <p class="model-card__meta">${escapeHtml(model.provider)} · ${escapeHtml(model.modelIdentifier)}</p>
              <p>${escapeHtml(AnalyzerFactory.describe(model))}</p>
              <div class="model-card__actions">
                <label class="switch">
                  <input type="checkbox" data-active ${model.isActive ? 'checked' : ''} ${model.isDefault ? 'disabled' : ''} />
                  <span>${model.isActive ? 'Activo' : 'Inactivo'}</span>
                </label>
                ${model.isDefault ? '' : '<button class="button button--ghost button--small" type="button" data-default>Usar como predeterminado</button>'}
              </div>
            </article>`,
          )
          .join('')}
      </div>`;

    container.querySelectorAll<HTMLElement>('[data-model]').forEach((card) => {
      const model = models.find((m) => m.id === Number(card.dataset.model))!;
      card.querySelector<HTMLInputElement>('[data-active]')!.addEventListener('change', (event) =>
        this.save(container, model, { isActive: (event.target as HTMLInputElement).checked }),
      );
      card.querySelector('[data-default]')?.addEventListener('click', () => this.save(container, model, { isDefault: true }));
    });
  }

  private async save(container: HTMLElement, model: AiModel, changes: { isActive?: boolean; isDefault?: boolean }): Promise<void> {
    try {
      const updated = await this.repo.updateAiModel(model.id, changes);
      CatalogService.getInstance().invalidate();
      const what = changes.isDefault ? 'es el modelo predeterminado' : updated.isActive ? 'fue activado' : 'fue desactivado';
      logActivity('Modelo de IA actualizado', `${updated.name} ${what}.`);
      Toast.success(`${updated.name} ${what}.`);
    } catch (error) {
      Toast.error(errorMessage(error));
    }
    this.mount(container);
  }
}
