import { ApiClient } from '../../core/http/ApiClient.ts';
import { ApiError } from '../../core/http/ApiError.ts';
import type { AiAnalysis } from '../../models/AiAnalysis.ts';
import type { StructuralElement, StructuralElementInput } from '../../models/StructuralElement.ts';
import type { AnalysisRepository } from '../repositories.ts';

/** /analyses, /analyses/{id}/elements and /elements/{id} */
export class ApiAnalysisRepository implements AnalysisRepository {
  private readonly api = ApiClient.getInstance();

  findAll(): Promise<AiAnalysis[]> {
    return this.api.get<AiAnalysis[]>('/analyses');
  }

  async findById(id: number): Promise<AiAnalysis | null> {
    try {
      return await this.api.get<AiAnalysis>(`/analyses/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  create(floorPlanId: number, aiModelId: number): Promise<AiAnalysis> {
    return this.api.post<AiAnalysis>('/analyses', { floorPlanId, aiModelId });
  }

  update(id: number, changes: Partial<Omit<AiAnalysis, 'id'>>): Promise<AiAnalysis> {
    return this.api.put<AiAnalysis>(`/analyses/${id}`, changes);
  }

  remove(id: number): Promise<void> {
    return this.api.delete<void>(`/analyses/${id}`);
  }

  findElements(analysisId: number): Promise<StructuralElement[]> {
    return this.api.get<StructuralElement[]>(`/analyses/${analysisId}/elements`);
  }

  saveElements(analysisId: number, elements: StructuralElementInput[]): Promise<StructuralElement[]> {
    return this.api.post<StructuralElement[]>(`/analyses/${analysisId}/elements`, elements);
  }

  updateElement(
    id: number,
    changes: { elementTypeId?: number; materialId?: number | null },
  ): Promise<StructuralElement> {
    return this.api.put<StructuralElement>(`/elements/${id}`, changes);
  }

  removeElement(id: number): Promise<void> {
    return this.api.delete<void>(`/elements/${id}`);
  }
}
