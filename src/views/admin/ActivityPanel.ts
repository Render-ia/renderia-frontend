import { repositories } from '../../data/dataSource.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { formatDateTime } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import type { AdminPanel } from './AdminPanel.ts';

/** Latest entries of activity_logs from every user. */
export class ActivityPanel implements AdminPanel {
  readonly id = 'activity';
  readonly label = 'Actividad';

  mount(container: HTMLElement): void {
    container.innerHTML = loadingState('Cargando actividad…');
    this.load(container);
  }

  private async load(container: HTMLElement): Promise<void> {
    try {
      const [logs, users] = await Promise.all([
        repositories().activity().findRecent(100),
        repositories().users().findAll(),
      ]);
      const names = new Map(users.map((u) => [u.id, u.fullName]));
      container.innerHTML = logs.length
        ? `<div class="table-wrap">
            <table class="table">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
              <tbody>
                ${logs
                  .map(
                    (log) => `
                    <tr>
                      <td>${formatDateTime(log.createdAt)}</td>
                      <td>${escapeHtml(log.userId === null ? 'Sistema' : (names.get(log.userId) ?? 'Usuario eliminado'))}</td>
                      <td><strong>${escapeHtml(log.action)}</strong></td>
                      <td>${escapeHtml(log.details)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`
        : '<p class="field__hint">Todavía no hay actividad registrada.</p>';
    } catch (error) {
      container.innerHTML = errorState(errorMessage(error));
      container.querySelector('[data-retry]')?.addEventListener('click', () => this.mount(container));
    }
  }
}
