import { statusBadge } from '../../analysis/AnalysisState.ts';
import { repositories } from '../../data/dataSource.ts';
import type { AiAnalysis } from '../../models/AiAnalysis.ts';
import type { CatalogItem } from '../../models/Catalog.ts';
import { PLAN_SCALES, type FloorPlan } from '../../models/FloorPlan.ts';
import type { Project } from '../../models/Project.ts';
import { CatalogService, nameOf } from '../../services/CatalogService.ts';
import { FloorPlanService, type UploadResult } from '../../services/FloorPlanService.ts';
import { ProjectService } from '../../services/ProjectService.ts';
import { Dialog } from '../../ui/Dialog.ts';
import { emptyState, errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { formatDate, plural } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { ACCEPTED_PLAN_TYPES } from '../../utils/image.ts';
import { View } from '../View.ts';
import { projectFields, readProjectForm } from './projectForm.ts';

export class ProjectDetailView extends View {
  title = 'Proyecto';

  private readonly projects = new ProjectService();
  private readonly plans = new FloorPlanService();
  private project: Project | null = null;
  private floorPlans: FloorPlan[] = [];
  private analyses: AiAnalysis[] = [];
  private buildingTypes: CatalogItem[] = [];

  constructor(private readonly projectId: number) {
    super();
  }

  protected render(): string {
    return `<div data-page>${loadingState('Cargando proyecto…')}</div>`;
  }

  protected afterRender(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const page = this.root?.querySelector<HTMLElement>('[data-page]');
    if (!page) return;
    try {
      const [project, catalogs] = await Promise.all([
        this.projects.get(this.projectId),
        CatalogService.getInstance().load(),
      ]);
      const [floorPlans, analyses] = await Promise.all([
        this.plans.listByProject(project.id),
        repositories().analyses().findAll(),
      ]);
      if (!this.root) return;
      this.project = project;
      this.floorPlans = floorPlans;
      this.analyses = analyses;
      this.buildingTypes = catalogs.buildingTypes;
      document.title = `${project.name} · Render.IA`;
      this.renderPage(page);
    } catch (error) {
      page.innerHTML = `
        <p class="breadcrumb"><a href="#/projects">Proyectos</a></p>
        ${errorState(errorMessage(error), false)}`;
    }
  }

  private renderPage(page: HTMLElement): void {
    const project = this.project!;
    const canManage = this.projects.canManage(project);

    page.innerHTML = `
      <p class="breadcrumb"><a href="#/projects">Proyectos</a> / ${escapeHtml(project.name)}</p>
      <header class="page-header page-header--row">
        <div>
          <h1>${escapeHtml(project.name)}</h1>
          ${project.description ? `<p class="page-header__lead">${escapeHtml(project.description)}</p>` : ''}
        </div>
        ${
          canManage
            ? `<div class="page-header__actions">
                <button class="button button--ghost" type="button" data-edit>Editar</button>
                <button class="button button--ghost button--danger-text" type="button" data-delete>Eliminar</button>
              </div>`
            : ''
        }
      </header>

      <dl class="facts">
        <div><dt>Tipo de edificación</dt><dd>${escapeHtml(nameOf(this.buildingTypes, project.buildingTypeId, 'Sin definir'))}</dd></div>
        <div><dt>Ubicación</dt><dd>${escapeHtml(project.location || 'Sin definir')}</dd></div>
        <div><dt>Creado</dt><dd>${formatDate(project.createdAt)}</dd></div>
        <div><dt>Planos</dt><dd>${plural(this.floorPlans.length, 'plano', 'planos')}</dd></div>
      </dl>

      <section class="section">
        <div class="section__header"><h2>Planos</h2></div>
        <div class="plan-layout">
          <div data-plans>${this.plansHtml()}</div>
          ${canManage ? this.uploadHtml() : ''}
        </div>
      </section>`;

    page.querySelector('[data-edit]')?.addEventListener('click', () => this.openEdit());
    page.querySelector('[data-delete]')?.addEventListener('click', () => this.confirmDelete());
    this.bindPlanActions(page);
    if (canManage) this.bindUpload(page);
  }

  private plansHtml(): string {
    if (this.floorPlans.length === 0) {
      return emptyState(
        'Este proyecto no tiene planos',
        'Sube el plano de planta de cada piso. La IA lo leerá y detectará los elementos estructurales.',
      );
    }
    const canManage = this.projects.canManage(this.project!);
    return `<div class="plan-grid">${this.floorPlans
      .map((plan) => {
        const latest = this.analyses.find((a) => a.floorPlanId === plan.id);
        return `
          <article class="plan-card">
            <div class="plan-card__image">
              <img src="${escapeHtml(plan.fileUrl)}" alt="Plano del piso ${plan.floorLevel}" loading="lazy" />
            </div>
            <div class="plan-card__body">
              <h3>Piso ${plan.floorLevel}</h3>
              <p class="plan-card__meta">${escapeHtml(plan.fileName)} · Escala ${escapeHtml(plan.scale)}</p>
              <p class="plan-card__status">
                ${latest ? `${statusBadge(latest.status)} <a href="#/analyses/${latest.id}">Ver análisis</a>` : '<span class="badge badge--neutral">Sin analizar</span>'}
              </p>
              <div class="plan-card__actions">
                <a class="button button--small" href="#/analyses/new/${plan.id}">Analizar con IA</a>
                ${latest?.status === 'COMPLETED' ? `<a class="button button--ghost button--small" href="#/viewer/${latest.id}">Ver en 3D</a>` : ''}
                ${canManage ? `<button class="button button--ghost button--small button--danger-text" type="button" data-remove-plan="${plan.id}">Eliminar</button>` : ''}
              </div>
            </div>
          </article>`;
      })
      .join('')}</div>`;
  }

  private uploadHtml(): string {
    const nextLevel = this.floorPlans.reduce((max, plan) => Math.max(max, plan.floorLevel), 0) + 1;
    const scales = PLAN_SCALES.map((s) => `<option ${s === '1:100' ? 'selected' : ''}>${s}</option>`).join('');
    return `
      <form class="upload" novalidate>
        <h3>Subir plano</h3>
        <label class="dropzone" data-dropzone>
          <input type="file" name="file" accept="${ACCEPTED_PLAN_TYPES.join(',')}" class="sr-only" />
          <span class="dropzone__title" data-file-name>Arrastra el plano aquí o haz clic para elegirlo</span>
          <span class="field__hint">PNG, JPG, WEBP o SVG. Máximo 10 MB.</span>
        </label>
        <div class="form-row">
          <label class="field">
            <span class="field__label">Piso</span>
            <input class="input" type="number" name="floorLevel" min="-5" max="200" value="${nextLevel}" required />
          </label>
          <label class="field">
            <span class="field__label">Escala del dibujo</span>
            <select class="select" name="scale">${scales}</select>
          </label>
        </div>
        <p class="field__hint">La escala se usa para convertir el plano a metros (escaneo a 150 ppp).</p>
        <p class="form-error" role="alert" hidden></p>
        <button class="button" type="submit">Subir plano</button>
        <button class="button button--ghost" type="button" data-sample>Usar plano de ejemplo</button>
      </form>`;
  }

  private bindPlanActions(page: HTMLElement): void {
    page.querySelectorAll<HTMLButtonElement>('[data-remove-plan]').forEach((button) => {
      button.addEventListener('click', async () => {
        const plan = this.floorPlans.find((p) => p.id === Number(button.dataset.removePlan))!;
        const confirmed = await Dialog.confirm({
          title: 'Eliminar plano',
          message: `Se eliminará el plano del piso ${plan.floorLevel} junto con sus análisis y modelos 3D.`,
          confirmLabel: 'Eliminar plano',
          danger: true,
        });
        if (!confirmed) return;
        try {
          await this.plans.remove(this.project!, plan);
          Toast.success('Plano eliminado.');
          this.load();
        } catch (error) {
          Toast.error(errorMessage(error));
        }
      });
    });
  }

  private bindUpload(page: HTMLElement): void {
    const form = page.querySelector<HTMLFormElement>('.upload')!;
    const input = form.querySelector<HTMLInputElement>('input[type="file"]')!;
    const dropzone = form.querySelector<HTMLElement>('[data-dropzone]')!;
    const fileName = form.querySelector<HTMLElement>('[data-file-name]')!;
    const error = form.querySelector<HTMLElement>('.form-error')!;
    let file: File | null = null;

    const pick = (picked: File | undefined) => {
      if (!picked) return;
      file = picked;
      fileName.textContent = picked.name;
      dropzone.classList.add('dropzone--ready');
    };

    input.addEventListener('change', () => pick(input.files?.[0]));
    dropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropzone.classList.add('dropzone--over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dropzone--over'));
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('dropzone--over');
      pick(event.dataTransfer?.files[0]);
    });

    const run = async (button: HTMLButtonElement, task: () => Promise<UploadResult>) => {
      error.hidden = true;
      button.disabled = true;
      try {
        const { adjustedScale } = await task();
        Toast.success(
          adjustedScale
            ? `Plano subido. Se redujo la imagen y la escala quedó en ${adjustedScale}.`
            : 'Plano subido. Ya puedes analizarlo con IA.',
        );
        this.load();
      } catch (problem) {
        error.textContent = errorMessage(problem);
        error.hidden = false;
        button.disabled = false;
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!file) {
        error.textContent = 'Elige el archivo del plano.';
        error.hidden = false;
        return;
      }
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const chosen = file;
      run(form.querySelector('[type="submit"]')!, () =>
        this.plans.upload({
          project: this.project!,
          file: chosen,
          floorLevel: Number(data.get('floorLevel')),
          scale: String(data.get('scale')),
        }),
      );
    });

    const sample = form.querySelector<HTMLButtonElement>('[data-sample]')!;
    sample.addEventListener('click', () => {
      const level = Number(new FormData(form).get('floorLevel')) || 1;
      run(sample, () => this.plans.uploadSample(this.project!, level));
    });
  }

  private openEdit(): void {
    const project = this.project!;
    Dialog.form('Editar proyecto', projectFields(this.buildingTypes, project), 'Guardar cambios', async (data, form) => {
      try {
        await this.projects.update(project, readProjectForm(data));
        Toast.success('Cambios guardados.');
        this.load();
        return true;
      } catch (error) {
        Dialog.showFormError(form, errorMessage(error));
        return false;
      }
    });
  }

  private async confirmDelete(): Promise<void> {
    const project = this.project!;
    const confirmed = await Dialog.confirm({
      title: 'Eliminar proyecto',
      message: `Se eliminará "${project.name}" con sus ${plural(this.floorPlans.length, 'plano', 'planos')}, análisis y modelos 3D. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar proyecto',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.projects.remove(project);
      Toast.success(`Proyecto "${project.name}" eliminado.`);
      window.location.hash = '/projects';
    } catch (error) {
      Toast.error(errorMessage(error));
    }
  }
}
