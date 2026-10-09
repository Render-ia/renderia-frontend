import { AppConfig } from '../../core/config/AppConfig.ts';
import { MockDatabase } from '../../data/mock/MockDatabase.ts';
import { CatalogService } from '../../services/CatalogService.ts';
import { Dialog } from '../../ui/Dialog.ts';
import { Toast } from '../../ui/Toast.ts';
import { View } from '../View.ts';
import { ActivityPanel } from './ActivityPanel.ts';
import type { AdminPanel } from './AdminPanel.ts';
import { AiModelsPanel } from './AiModelsPanel.ts';
import { CatalogsPanel } from './CatalogsPanel.ts';
import { UsersPanel } from './UsersPanel.ts';

/** Administration screen: one tab per panel. Only for the Administrador role. */
export class AdminView extends View {
  readonly title = 'Administración';

  private readonly panels: AdminPanel[] = [new UsersPanel(), new CatalogsPanel(), new AiModelsPanel(), new ActivityPanel()];

  constructor(private active = 'users') {
    super();
  }

  protected render(): string {
    const isMock = AppConfig.getInstance().dataSource === 'mock';
    return `
      <header class="page-header page-header--row">
        <div>
          <h1>Administración</h1>
          <p class="page-header__lead">Usuarios, catálogos y modelos de IA de la plataforma.</p>
        </div>
        ${isMock ? '<div class="page-header__actions"><button class="button button--ghost button--danger-text" type="button" data-reset>Restablecer datos de prueba</button></div>' : ''}
      </header>
      <div class="tabs" role="tablist" aria-label="Secciones de administración">
        ${this.panels
          .map(
            (panel) =>
              `<button class="tabs__tab" type="button" role="tab" id="tab-${panel.id}" aria-controls="panel" data-panel="${panel.id}">${panel.label}</button>`,
          )
          .join('')}
      </div>
      <section class="tabs__panel" id="panel" role="tabpanel" data-panel-body></section>`;
  }

  protected afterRender(container: HTMLElement): void {
    container.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((tab) =>
      tab.addEventListener('click', () => this.open(container, tab.dataset.panel!)),
    );
    container.querySelector('[data-reset]')?.addEventListener('click', () => this.reset());
    this.open(container, this.active);
  }

  private open(container: HTMLElement, id: string): void {
    const panel = this.panels.find((p) => p.id === id) ?? this.panels[0];
    this.active = panel.id;
    container.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.panel === panel.id));
    });
    const body = container.querySelector<HTMLElement>('[data-panel-body]')!;
    body.setAttribute('aria-labelledby', `tab-${panel.id}`);
    panel.mount(body);
  }

  /** Demo mode only: wipes the browser database and loads the initial data again. */
  private async reset(): Promise<void> {
    const confirmed = await Dialog.confirm({
      title: 'Restablecer datos de prueba',
      message: 'Se borrarán los proyectos, planos y análisis guardados en este navegador, y se cargarán los datos iniciales.',
      confirmLabel: 'Restablecer',
      danger: true,
    });
    if (!confirmed) return;
    MockDatabase.getInstance().reset();
    CatalogService.getInstance().invalidate();
    Toast.success('Datos restablecidos. Inicia sesión de nuevo.');
    window.setTimeout(() => window.location.reload(), 900);
  }
}
