import { repositories } from '../../data/dataSource.ts';
import { CATALOG_LABELS, type CatalogItem, type CatalogName } from '../../models/Catalog.ts';
import { logActivity } from '../../services/ActivityLogger.ts';
import { CatalogService } from '../../services/CatalogService.ts';
import { Dialog } from '../../ui/Dialog.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { escapeHtml } from '../../utils/html.ts';
import type { AdminPanel } from './AdminPanel.ts';

const CATALOGS = Object.keys(CATALOG_LABELS) as CatalogName[];

/** Add, rename and delete the entries of the three catalog tables. */
export class CatalogsPanel implements AdminPanel {
  readonly id = 'catalogs';
  readonly label = 'Catálogos';

  private readonly repo = repositories().catalogs();
  private current: CatalogName = 'building-types';

  mount(container: HTMLElement): void {
    container.innerHTML = `
      <div class="segmented" role="tablist" aria-label="Catálogo">
        ${CATALOGS.map(
          (name) =>
            `<button class="segmented__item" type="button" role="tab" data-catalog="${name}" aria-selected="${name === this.current}">${CATALOG_LABELS[name]}</button>`,
        ).join('')}
      </div>
      <div data-catalog-body></div>`;

    container.querySelectorAll<HTMLButtonElement>('[data-catalog]').forEach((button) =>
      button.addEventListener('click', () => {
        this.current = button.dataset.catalog as CatalogName;
        this.mount(container);
      }),
    );
    this.load(container.querySelector('[data-catalog-body]')!);
  }

  private async load(body: HTMLElement): Promise<void> {
    body.innerHTML = loadingState();
    try {
      const items = await this.repo.list(this.current);
      this.render(body, items);
    } catch (error) {
      body.innerHTML = errorState(errorMessage(error));
      body.querySelector('[data-retry]')?.addEventListener('click', () => this.load(body));
    }
  }

  private render(body: HTMLElement, items: CatalogItem[]): void {
    body.innerHTML = `
      <div class="section__header">
        <p class="field__hint">${items.length} registros en ${CATALOG_LABELS[this.current].toLowerCase()}.</p>
        <button class="button button--small" type="button" data-add>Agregar</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Nombre</th><th>Descripción</th><th><span class="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            ${items
              .map(
                (item) => `
                <tr data-item="${item.id}">
                  <td><strong>${escapeHtml(item.name)}</strong></td>
                  <td>${escapeHtml(item.description)}</td>
                  <td>
                    <div class="table__actions">
                      <button class="button button--ghost button--small" type="button" data-edit>Editar</button>
                      <button class="button button--ghost button--small button--danger-text" type="button" data-remove>Eliminar</button>
                    </div>
                  </td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    body.querySelector('[data-add]')!.addEventListener('click', () => this.openForm(body));
    body.querySelectorAll<HTMLTableRowElement>('[data-item]').forEach((row) => {
      const item = items.find((i) => i.id === Number(row.dataset.item))!;
      row.querySelector('[data-edit]')!.addEventListener('click', () => this.openForm(body, item));
      row.querySelector('[data-remove]')!.addEventListener('click', () => this.remove(body, item));
    });
  }

  private openForm(body: HTMLElement, item?: CatalogItem): void {
    const fields = `
      <label class="field">
        <span class="field__label">Nombre</span>
        <input class="input" name="name" required maxlength="80" value="${escapeHtml(item?.name ?? '')}" />
      </label>
      <label class="field">
        <span class="field__label">Descripción</span>
        <input class="input" name="description" maxlength="255" value="${escapeHtml(item?.description ?? '')}" />
      </label>`;
    const title = item ? 'Editar registro' : `Agregar a ${CATALOG_LABELS[this.current].toLowerCase()}`;

    Dialog.form(title, fields, item ? 'Guardar cambios' : 'Agregar', async (data, form) => {
      const input = { name: String(data.get('name')).trim(), description: String(data.get('description')).trim() };
      try {
        if (item) await this.repo.update(this.current, item.id, input);
        else await this.repo.create(this.current, input);
        CatalogService.getInstance().invalidate();
        logActivity('Catálogo actualizado', `${item ? 'Se editó' : 'Se agregó'} "${input.name}" en ${CATALOG_LABELS[this.current]}.`);
        Toast.success(item ? 'Cambios guardados.' : `"${input.name}" agregado.`);
        this.load(body);
        return true;
      } catch (error) {
        Dialog.showFormError(form, errorMessage(error));
        return false;
      }
    });
  }

  private async remove(body: HTMLElement, item: CatalogItem): Promise<void> {
    const confirmed = await Dialog.confirm({
      title: 'Eliminar registro',
      message: `Se eliminará "${item.name}" de ${CATALOG_LABELS[this.current].toLowerCase()}.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.repo.remove(this.current, item.id);
      CatalogService.getInstance().invalidate();
      logActivity('Catálogo actualizado', `Se eliminó "${item.name}" de ${CATALOG_LABELS[this.current]}.`);
      Toast.success(`"${item.name}" eliminado.`);
      this.load(body);
    } catch (error) {
      Toast.error(errorMessage(error));
    }
  }
}
