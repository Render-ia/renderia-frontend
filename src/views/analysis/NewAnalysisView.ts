import { AnalysisFacade } from '../../analysis/AnalysisFacade.ts';
import { AnalyzerFactory } from '../../analysis/AnalyzerFactory.ts';
import type { AiModel } from '../../models/Catalog.ts';
import type { FloorPlan } from '../../models/FloorPlan.ts';
import type { Project } from '../../models/Project.ts';
import { AnalysisService } from '../../services/AnalysisService.ts';
import { CatalogService } from '../../services/CatalogService.ts';
import { emptyState, errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { escapeHtml } from '../../utils/html.ts';
import { View } from '../View.ts';

/** Choose a plan and a model, then run the analysis while showing its progress. */
export class NewAnalysisView extends View {
  readonly title = 'Nuevo análisis';

  private plans: { plan: FloorPlan; project: Project }[] = [];
  private models: AiModel[] = [];
  private running = false;

  constructor(private readonly preselectedPlanId: number | null) {
    super();
  }

  protected render(): string {
    return `
      <p class="breadcrumb"><a href="#/analyses">Análisis IA</a> / Nuevo</p>
      <header class="page-header">
        <h1>Analizar un plano</h1>
        <p class="page-header__lead">Elige el plano y el modelo. La IA encontrará los elementos estructurales y armará el modelo 3D.</p>
      </header>
      <div data-body>${loadingState('Cargando planos y modelos…')}</div>`;
  }

  protected afterRender(): void {
    this.load();
  }

  unmount(): void {
    if (this.running) Toast.show('El análisis sigue en curso; lo verás en la lista cuando termine.');
    super.unmount();
  }

  private async load(): Promise<void> {
    const body = this.root?.querySelector<HTMLElement>('[data-body]');
    if (!body) return;
    try {
      const [plans, catalogs] = await Promise.all([
        new AnalysisService().plansToAnalyze(),
        CatalogService.getInstance().load(),
      ]);
      this.plans = plans;
      this.models = catalogs.aiModels.filter((m) => m.isActive);
      if (!this.root) return;
      this.renderForm(body);
    } catch (error) {
      body.innerHTML = errorState(errorMessage(error));
      body.querySelector('[data-retry]')?.addEventListener('click', () => this.load());
    }
  }

  private renderForm(body: HTMLElement): void {
    if (this.plans.length === 0) {
      body.innerHTML = emptyState(
        'No tienes planos para analizar',
        'Sube un plano a uno de tus proyectos y vuelve aquí.',
        '<a class="button" href="#/projects">Ir a proyectos</a>',
      );
      return;
    }
    if (this.models.length === 0) {
      body.innerHTML = emptyState(
        'No hay modelos de IA activos',
        'Un administrador debe activar al menos un modelo en Administración.',
      );
      return;
    }

    const selected = this.plans.find((p) => p.plan.id === this.preselectedPlanId) ?? this.plans[0];
    const planOptions = this.plans
      .map(
        ({ plan, project }) =>
          `<option value="${plan.id}" ${plan.id === selected.plan.id ? 'selected' : ''}>${escapeHtml(project.name)} · Piso ${plan.floorLevel} (${escapeHtml(plan.scale)})</option>`,
      )
      .join('');
    const defaultModel = this.models.find((m) => m.isDefault) ?? this.models[0];
    const modelOptions = this.models
      .map(
        (model) => `
          <label class="model-option">
            <input type="radio" name="model" value="${model.id}" ${model.id === defaultModel.id ? 'checked' : ''} />
            <span>
              <strong>${escapeHtml(model.name)}</strong>
              <small>${escapeHtml(AnalyzerFactory.describe(model))}</small>
            </span>
          </label>`,
      )
      .join('');

    body.innerHTML = `
      <form class="new-analysis" novalidate>
        <div class="new-analysis__plan">
          <label class="field">
            <span class="field__label">Plano</span>
            <select class="select" name="plan">${planOptions}</select>
          </label>
          <div class="new-analysis__preview"><img alt="Vista previa del plano" data-preview /></div>
        </div>
        <div class="new-analysis__side">
          <fieldset class="model-picker">
            <legend class="field__label">Modelo de IA</legend>
            ${modelOptions}
          </fieldset>
          <button class="button new-analysis__run" type="submit">Analizar plano</button>
          <ol class="progress" data-progress hidden></ol>
        </div>
      </form>`;

    const form = body.querySelector<HTMLFormElement>('form')!;
    const select = form.querySelector<HTMLSelectElement>('[name="plan"]')!;
    const preview = form.querySelector<HTMLImageElement>('[data-preview]')!;
    const showPreview = () => {
      preview.src = this.plans.find((p) => p.plan.id === Number(select.value))!.plan.fileUrl;
    };
    select.addEventListener('change', showPreview);
    showPreview();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const plan = this.plans.find((p) => p.plan.id === Number(data.get('plan')))!.plan;
      const model = this.models.find((m) => m.id === Number(data.get('model')))!;
      this.run(form, plan, model);
    });
  }

  private async run(form: HTMLFormElement, plan: FloorPlan, model: AiModel): Promise<void> {
    const button = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const progress = form.querySelector<HTMLOListElement>('[data-progress]')!;
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((el) => (el.disabled = true));
    button.disabled = true;
    button.textContent = 'Analizando…';
    progress.hidden = false;
    progress.innerHTML = '';
    this.running = true;

    const addStep = (text: string) => {
      progress.querySelector('.progress__step--current')?.classList.replace('progress__step--current', 'progress__step--done');
      progress.insertAdjacentHTML('beforeend', `<li class="progress__step progress__step--current">${escapeHtml(text)}</li>`);
    };

    const analysis = await new AnalysisFacade().run({ plan, model, onProgress: addStep });
    this.running = false;

    if (analysis.status === 'COMPLETED') {
      Toast.success('Análisis completado.');
    } else {
      Toast.error(analysis.errorMessage ?? 'El análisis falló.');
    }
    if (this.root) window.location.hash = `/analyses/${analysis.id}`;
  }
}
