import { ApiClient } from '../../core/http/ApiClient.ts';
import type { AiModel, CatalogItem, CatalogName } from '../../models/Catalog.ts';
import type { CatalogRepository } from '../repositories.ts';

/** /building-types, /element-types, /materials and /ai-models */
export class ApiCatalogRepository implements CatalogRepository {
  private readonly api = ApiClient.getInstance();

  list(catalog: CatalogName): Promise<CatalogItem[]> {
    return this.api.get<CatalogItem[]>(`/${catalog}`);
  }

  create(catalog: CatalogName, input: Omit<CatalogItem, 'id'>): Promise<CatalogItem> {
    return this.api.post<CatalogItem>(`/${catalog}`, input);
  }

  update(catalog: CatalogName, id: number, input: Omit<CatalogItem, 'id'>): Promise<CatalogItem> {
    return this.api.put<CatalogItem>(`/${catalog}/${id}`, input);
  }

  remove(catalog: CatalogName, id: number): Promise<void> {
    return this.api.delete<void>(`/${catalog}/${id}`);
  }

  listAiModels(): Promise<AiModel[]> {
    return this.api.get<AiModel[]>('/ai-models');
  }

  updateAiModel(id: number, changes: { isActive?: boolean; isDefault?: boolean }): Promise<AiModel> {
    return this.api.put<AiModel>(`/ai-models/${id}`, changes);
  }
}
