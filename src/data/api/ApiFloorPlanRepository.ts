import { ApiClient } from '../../core/http/ApiClient.ts';
import { ApiError } from '../../core/http/ApiError.ts';
import type { FloorPlan, FloorPlanInput } from '../../models/FloorPlan.ts';
import type { FloorPlanRepository, PreparedImage } from '../repositories.ts';

/** /floor-plans and /projects/{id}/floor-plans (multipart upload) */
export class ApiFloorPlanRepository implements FloorPlanRepository {
  private readonly api = ApiClient.getInstance();

  findAll(): Promise<FloorPlan[]> {
    return this.api.get<FloorPlan[]>('/floor-plans');
  }

  findByProject(projectId: number): Promise<FloorPlan[]> {
    return this.api.get<FloorPlan[]>(`/projects/${projectId}/floor-plans`);
  }

  async findById(id: number): Promise<FloorPlan | null> {
    try {
      return await this.api.get<FloorPlan>(`/floor-plans/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  create(input: Omit<FloorPlanInput, 'fileUrl'>, image: PreparedImage): Promise<FloorPlan> {
    const form = new FormData();
    form.append('file', image.blob, input.fileName);
    form.append('floorLevel', String(input.floorLevel));
    form.append('scale', input.scale);
    return this.api.upload<FloorPlan>(`/projects/${input.projectId}/floor-plans`, form);
  }

  remove(id: number): Promise<void> {
    return this.api.delete<void>(`/floor-plans/${id}`);
  }
}
