import { Session } from '../auth/Session.ts';
import { ApiError } from '../core/http/ApiError.ts';
import { repositories } from '../data/dataSource.ts';
import type { AiAnalysis } from '../models/AiAnalysis.ts';
import type { AiModel } from '../models/Catalog.ts';
import type { FloorPlan } from '../models/FloorPlan.ts';
import type { Model3D } from '../models/Model3D.ts';
import type { Project } from '../models/Project.ts';
import type { StructuralElement } from '../models/StructuralElement.ts';
import { logActivity } from './ActivityLogger.ts';
import { CatalogService } from './CatalogService.ts';
import { ProjectService } from './ProjectService.ts';

/** An analysis together with everything needed to show it. */
export interface AnalysisRow {
  analysis: AiAnalysis;
  plan: FloorPlan;
  project: Project;
  model: AiModel | null;
  model3d: Model3D | null;
}

export interface AnalysisDetail extends AnalysisRow {
  elements: StructuralElement[];
}

/** Reads and changes analyses, limited to the projects the user can see. */
export class AnalysisService {
  private readonly repos = repositories();
  private readonly projects = new ProjectService();

  async listVisible(): Promise<AnalysisRow[]> {
    const [projects, plans, analyses, models3d, catalogs] = await Promise.all([
      this.projects.listVisible(),
      this.repos.floorPlans().findAll(),
      this.repos.analyses().findAll(),
      this.repos.models3d().findAll(),
      CatalogService.getInstance().load(),
    ]);
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const planById = new Map(plans.filter((p) => projectById.has(p.projectId)).map((p) => [p.id, p]));

    return analyses
      .filter((analysis) => planById.has(analysis.floorPlanId))
      .map((analysis) => {
        const plan = planById.get(analysis.floorPlanId)!;
        return {
          analysis,
          plan,
          project: projectById.get(plan.projectId)!,
          model: catalogs.aiModels.find((m) => m.id === analysis.aiModelId) ?? null,
          model3d: models3d.find((m) => m.aiAnalysisId === analysis.id) ?? null,
        };
      });
  }

  async get(id: number): Promise<AnalysisDetail> {
    const analysis = await this.repos.analyses().findById(id);
    const plan = analysis && (await this.repos.floorPlans().findById(analysis.floorPlanId));
    if (!analysis || !plan) throw new ApiError('El análisis no existe.', 404);

    const project = await this.projects.get(plan.projectId);
    const [elements, model3d, catalogs] = await Promise.all([
      this.repos.analyses().findElements(id),
      this.repos.models3d().findByAnalysis(id),
      CatalogService.getInstance().load(),
    ]);
    return {
      analysis,
      plan,
      project,
      elements,
      model3d,
      model: catalogs.aiModels.find((m) => m.id === analysis.aiModelId) ?? null,
    };
  }

  /** Planes the user may analyze: those of projects they can manage. */
  async plansToAnalyze(): Promise<{ plan: FloorPlan; project: Project }[]> {
    const [projects, plans] = await Promise.all([this.projects.listVisible(), this.repos.floorPlans().findAll()]);
    const manageable = new Map(projects.filter((p) => this.projects.canManage(p)).map((p) => [p.id, p]));
    return plans.filter((plan) => manageable.has(plan.projectId)).map((plan) => ({ plan, project: manageable.get(plan.projectId)! }));
  }

  canEdit(project: Project): boolean {
    return this.projects.canManage(project) && Session.getInstance().can('elements:edit');
  }

  async updateElement(
    detail: AnalysisDetail,
    element: StructuralElement,
    changes: { elementTypeId?: number; materialId?: number | null },
  ): Promise<StructuralElement> {
    this.assertCanEdit(detail.project);
    return this.repos.analyses().updateElement(element.id, changes);
  }

  async removeElement(detail: AnalysisDetail, element: StructuralElement): Promise<void> {
    this.assertCanEdit(detail.project);
    await this.repos.analyses().removeElement(element.id);
    logActivity('Elemento eliminado', `Se quitó un elemento del análisis #${detail.analysis.id}.`);
  }

  async remove(detail: AnalysisRow): Promise<void> {
    if (!this.projects.canManage(detail.project)) {
      throw new ApiError('Solo el dueño del proyecto puede eliminar sus análisis.', 403);
    }
    await this.repos.analyses().remove(detail.analysis.id);
    logActivity('Análisis eliminado', `Se eliminó el análisis #${detail.analysis.id} de "${detail.project.name}".`);
  }

  private assertCanEdit(project: Project): void {
    if (!this.canEdit(project)) throw new ApiError('No puedes corregir los elementos de este análisis.', 403);
  }
}
