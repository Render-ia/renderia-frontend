import { Session } from '../../auth/Session.ts';
import { repositories } from '../../data/dataSource.ts';
import type { CatalogItem } from '../../models/Catalog.ts';
import type { FloorPlan } from '../../models/FloorPlan.ts';
import type { Project } from '../../models/Project.ts';
import type { UserWithRole } from '../../models/User.ts';
import { CatalogService, nameOf } from '../../services/CatalogService.ts';
import { ProjectService } from '../../services/ProjectService.ts';
import { Dialog } from '../../ui/Dialog.ts';
import { emptyState, errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { formatRelative, plural } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { View } from '../View.ts';
import { projectFields, readProjectForm } from './projectForm.ts';

interface ProjectRow {
  project: Project;
  plans: FloorPlan[];
}

export class ProjectsView extends View {
  readonly title = 'Proyectos';

  private readonly service = new ProjectService();
  private readonly session = Session.getInstance();
  private rows: ProjectRow[] = [];
  private buildingTypes: CatalogItem[] = [];
  private owners = new Map<number, UserWithRole>();
  private query = '';
  private typeFilter = '';

  protected render(): string {
    return `
      <header class="page-header page-header--row">
        <div>
          <h1>Proyectos</h1>
          <p class="page-header__lead">Cada proyecto agrupa los planos de una edificación.</p>
        </div>
        <div class="page-header__actions">
          <button class="button" type="button" data-new>Nuevo proyecto</button>
        </div>
        <p class="page-header__note" data-limit hidden></p>
      </header>
      <div class="toolbar">
        <input class="input" type="search" placeholder="Buscar por nombre o ubicación" aria-label="Buscar proyectos" data-search />
        <select class="select" aria-label="Filtrar por tipo de edificación" data-type>
          <option value="">Todos los tipos</option>
        </select>
      </div>
      <div data-list>${loadingState('Cargando proyectos…')}</div>`;
  }

  protected afterRender(container: HTMLElement): void {
    container.querySelector('[data-new]')!.addEventListener('click', () => this.openCreate());
    container.querySelector<HTMLInputElement>('[data-search]')!.addEventListener('input', (event) => {
      this.query = (event.target as HTMLInputElement).value.trim().toLowerCase();
      this.renderList();
    });
    container.querySelector<HTMLSelectElement>('[data-type]')!.addEventListener('change', (event) => {
      this.typeFilter = (event.target as HTMLSelectElement).value;
      this.renderList();
    });
    this.load();
  }

  private async load(): Promise<void> {
    const list = this.root?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;
    try {
      const [projects, plans, catalogs] = await Promise.all([
        this.service.listVisible(),
        repositories().floorPlans().findAll(),
        CatalogService.getInstance().load(),
      ]);
      this.buildingTypes = catalogs.buildingTypes;
      this.rows = projects.map((project) => ({
        project,
        plans: plans.filter((plan) => plan.projectId === project.id),
      }));
      if (this.session.can('projects:view-all')) {
        const users = await repositories().users().findAll();
        this.owners = new Map(users.map((u) => [u.id, u]));
      }
      if (!this.root) return;
      this.fillTypeFilter();
      await this.updateLimitNote();
      this.renderList();
    } catch (error) {
      list.innerHTML = errorState(errorMessage(error));
      list.querySelector('[data-retry]')?.addEventListener('click', () => {
        list.innerHTML = loadingState('Cargando proyectos…');
        this.load();
      });
    }
  }

  private fillTypeFilter(): void {
    const select = this.root!.querySelector<HTMLSelectElement>('[data-type]')!;
    select.insertAdjacentHTML(
      'beforeend',
      this.buildingTypes.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join(''),
    );
  }

  /** Students see how many projects they have left. */
  private async updateLimitNote(): Promise<void> {
    const limit = this.session.policy.projectLimit();
    if (!Number.isFinite(limit) || !this.root) return;
    const remaining = await this.service.remainingSlots();
    const note = this.root.querySelector<HTMLElement>('[data-limit]')!;
    const button = this.root.querySelector<HTMLButtonElement>('[data-new]')!;
    note.hidden = false;
    note.textContent =
      remaining > 0
        ? `Con tu rol puedes tener hasta ${limit} proyectos. Te quedan ${remaining}.`
        : `Llegaste al límite de ${limit} proyectos de tu rol. Elimina uno para crear otro.`;
    button.disabled = remaining <= 0;
  }

  private renderList(): void {
    const list = this.root?.querySelector<HTMLElement>('[data-list]');
    if (!list) return;

    if (this.rows.length === 0) {
      list.innerHTML = emptyState(
        'Todavía no tienes proyectos',
        'Crea un proyecto para subir los planos de una edificación y analizarlos con IA.',
        '<button class="button" type="button" data-empty-new>Crear el primer proyecto</button>',
      );
      list.querySelector('[data-empty-new]')?.addEventListener('click', () => this.openCreate());
      return;
    }

    const visible = this.rows.filter(({ project }) => {
      const matchesText =
        !this.query ||
        project.name.toLowerCase().includes(this.query) ||
        project.location.toLowerCase().includes(this.query);
      const matchesType = !this.typeFilter || String(project.buildingTypeId) === this.typeFilter;
      return matchesText && matchesType;
    });

    if (visible.length === 0) {
      list.innerHTML = emptyState('Sin resultados', 'Ningún proyecto coincide con la búsqueda.');
      return;
    }
    list.innerHTML = `<div class="project-grid">${visible.map((row) => this.card(row)).join('')}</div>`;
  }

  private card({ project, plans }: ProjectRow): string {
    const owner = this.owners.get(project.userId);
    const thumb = plans[0]
      ? `<img src="${escapeHtml(plans[0].fileUrl)}" alt="" loading="lazy" />`
      : '<span class="project-card__no-plan">Sin planos</span>';
    return `
      <a class="project-card" href="#/projects/${project.id}">
        <div class="project-card__thumb">${thumb}</div>
        <div class="project-card__body">
          <h3>${escapeHtml(project.name)}</h3>
          <p class="project-card__meta">
            ${escapeHtml(nameOf(this.buildingTypes, project.buildingTypeId, 'Tipo sin definir'))}
            ${project.location ? `<span>${escapeHtml(project.location)}</span>` : ''}
          </p>
          <p class="project-card__footer">
            <span>${plural(plans.length, 'plano', 'planos')}</span>
            <span>Actualizado ${formatRelative(project.updatedAt)}</span>
          </p>
          ${owner && owner.id !== this.session.user?.id ? `<p class="project-card__owner">De ${escapeHtml(owner.fullName)}</p>` : ''}
        </div>
      </a>`;
  }

  private openCreate(): void {
    Dialog.form('Nuevo proyecto', projectFields(this.buildingTypes), 'Crear proyecto', async (data, form) => {
      try {
        const project = await this.service.create(readProjectForm(data));
        Toast.success(`Proyecto "${project.name}" creado.`);
        window.location.hash = `/projects/${project.id}`;
        return true;
      } catch (error) {
        Dialog.showFormError(form, errorMessage(error));
        return false;
      }
    });
  }
}
