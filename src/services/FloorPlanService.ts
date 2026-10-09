import { adjustScale } from '../analysis/scale.ts';
import { repositories } from '../data/dataSource.ts';
import type { FloorPlan } from '../models/FloorPlan.ts';
import type { Project } from '../models/Project.ts';
import { preparePlanImage } from '../utils/image.ts';
import { logActivity } from './ActivityLogger.ts';
import { ProjectService } from './ProjectService.ts';

export interface UploadPlanInput {
  project: Project;
  file: File;
  floorLevel: number;
  scale: string;
}

export interface UploadResult {
  plan: FloorPlan;
  /** Set when the image was reduced and the scale had to be adjusted. */
  adjustedScale: string | null;
}

/** Upload and removal of floor plans, always through the project's permissions. */
export class FloorPlanService {
  private readonly repo = repositories().floorPlans();
  private readonly projects = new ProjectService();

  /** Plans of every project the user can see, newest first. */
  async listVisible(): Promise<{ plan: FloorPlan; project: Project }[]> {
    const [projects, plans] = await Promise.all([this.projects.listVisible(), this.repo.findAll()]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    return plans.filter((plan) => byId.has(plan.projectId)).map((plan) => ({ plan, project: byId.get(plan.projectId)! }));
  }

  listByProject(projectId: number): Promise<FloorPlan[]> {
    return this.repo.findByProject(projectId);
  }

  async upload(input: UploadPlanInput): Promise<UploadResult> {
    if (!this.projects.canManage(input.project)) {
      throw new Error('Solo el dueño del proyecto puede subir planos.');
    }
    const image = await preparePlanImage(input.file);
    const scale = adjustScale(input.scale, image.reduction);

    const plan = await this.repo.create(
      { projectId: input.project.id, fileName: input.file.name, floorLevel: input.floorLevel, scale },
      image,
    );
    logActivity('Plano subido', `Se subió "${plan.fileName}" (piso ${plan.floorLevel}) al proyecto "${input.project.name}".`);
    return { plan, adjustedScale: scale === input.scale ? null : scale };
  }

  /** Loads the bundled sample plan as if the user had uploaded it. */
  async uploadSample(project: Project, floorLevel: number): Promise<UploadResult> {
    const response = await fetch('/samples/plano-casa.svg');
    const blob = await response.blob();
    const file = new File([blob], 'plano-casa.svg', { type: 'image/svg+xml' });
    return this.upload({ project, file, floorLevel, scale: '1:100' });
  }

  async remove(project: Project, plan: FloorPlan): Promise<void> {
    if (!this.projects.canManage(project)) {
      throw new Error('Solo el dueño del proyecto puede eliminar planos.');
    }
    await this.repo.remove(plan.id);
    logActivity('Plano eliminado', `Se eliminó "${plan.fileName}" del proyecto "${project.name}".`);
  }
}
