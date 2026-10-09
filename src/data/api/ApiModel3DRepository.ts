import { ApiClient } from '../../core/http/ApiClient.ts';
import { ApiError } from '../../core/http/ApiError.ts';
import type { Model3D } from '../../models/Model3D.ts';
import type { Model3DRepository } from '../repositories.ts';

/** /models-3d */
export class ApiModel3DRepository implements Model3DRepository {
  private readonly api = ApiClient.getInstance();

  findAll(): Promise<Model3D[]> {
    return this.api.get<Model3D[]>('/models-3d');
  }

  async findByAnalysis(analysisId: number): Promise<Model3D | null> {
    try {
      return await this.api.get<Model3D>(`/analyses/${analysisId}/model-3d`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  create(input: Omit<Model3D, 'id' | 'createdAt'>): Promise<Model3D> {
    return this.api.post<Model3D>('/models-3d', input);
  }
}
