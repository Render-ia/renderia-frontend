import { Session } from '../../auth/Session.ts';
import { repositories } from '../../data/dataSource.ts';
import type { Role } from '../../models/Role.ts';
import type { UserWithRole } from '../../models/User.ts';
import { logActivity } from '../../services/ActivityLogger.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { formatDate } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import type { AdminPanel } from './AdminPanel.ts';

/** Change each user's role and turn accounts on or off. */
export class UsersPanel implements AdminPanel {
  readonly id = 'users';
  readonly label = 'Usuarios';

  private readonly repo = repositories().users();
  private users: UserWithRole[] = [];
  private roles: Role[] = [];

  mount(container: HTMLElement): void {
    container.innerHTML = loadingState('Cargando usuarios…');
    this.load(container);
  }

  private async load(container: HTMLElement): Promise<void> {
    try {
      [this.users, this.roles] = await Promise.all([this.repo.findAll(), this.repo.listRoles()]);
      this.render(container);
    } catch (error) {
      container.innerHTML = errorState(errorMessage(error));
      container.querySelector('[data-retry]')?.addEventListener('click', () => this.mount(container));
    }
  }

  private render(container: HTMLElement): void {
    const me = Session.getInstance().user?.id;
    container.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Registro</th></tr></thead>
          <tbody>
            ${this.users
              .map(
                (user) => `
                <tr data-user="${user.id}">
                  <td><strong>${escapeHtml(user.fullName)}</strong>${user.id === me ? ' <small>(tú)</small>' : ''}</td>
                  <td>${escapeHtml(user.email)}</td>
                  <td>
                    <select class="select select--compact" data-role aria-label="Rol de ${escapeHtml(user.fullName)}" ${user.id === me ? 'disabled' : ''}>
                      ${this.roles.map((r) => `<option value="${r.id}" ${r.id === user.roleId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    <label class="switch">
                      <input type="checkbox" data-active ${user.isActive ? 'checked' : ''} ${user.id === me ? 'disabled' : ''} />
                      <span>${user.isActive ? 'Activo' : 'Desactivado'}</span>
                    </label>
                  </td>
                  <td>${formatDate(user.createdAt)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <p class="field__hint">No puedes cambiar tu propio rol ni desactivar tu cuenta.</p>`;

    container.querySelectorAll<HTMLTableRowElement>('[data-user]').forEach((row) => {
      const user = this.users.find((u) => u.id === Number(row.dataset.user))!;
      row.querySelector<HTMLSelectElement>('[data-role]')!.addEventListener('change', (event) =>
        this.save(container, user, { roleId: Number((event.target as HTMLSelectElement).value) }),
      );
      row.querySelector<HTMLInputElement>('[data-active]')!.addEventListener('change', (event) =>
        this.save(container, user, { isActive: (event.target as HTMLInputElement).checked }),
      );
    });
  }

  private async save(container: HTMLElement, user: UserWithRole, changes: { roleId?: number; isActive?: boolean }): Promise<void> {
    try {
      const updated = await this.repo.update(user.id, changes);
      Object.assign(user, updated);
      const what =
        changes.roleId !== undefined
          ? `ahora es ${updated.role.name}`
          : updated.isActive
            ? 'fue activado'
            : 'fue desactivado';
      logActivity('Usuario actualizado', `${updated.fullName} ${what}.`);
      Toast.success(`${updated.fullName} ${what}.`);
    } catch (error) {
      Toast.error(errorMessage(error));
    }
    this.mount(container);
  }
}
