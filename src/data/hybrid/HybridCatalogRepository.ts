import type { AiModel, CatalogItem, CatalogName } from '../../models/Catalog.ts';
import type { CatalogRepository } from '../repositories.ts';

/**
 * Catalogs (building types, element types, materials) come from the backend;
 * AI models stay in the browser until the backend lists the local vision model.
 */
export class HybridCatalogRepository implements CatalogRepository {
  constructor(
    private readonly remote: CatalogRepository,
    private readonly local: CatalogRepository,
  ) {}

  list(catalog: CatalogName): Promise<CatalogItem[]> {
    return this.remote.list(catalog);
  }

  create(catalog: CatalogName, input: Omit<CatalogItem, 'id'>): Promise<CatalogItem> {
    return this.remote.create(catalog, input);
  }

  update(catalog: CatalogName, id: number, input: Omit<CatalogItem, 'id'>): Promise<CatalogItem> {
    return this.remote.update(catalog, id, input);
  }

  remove(catalog: CatalogName, id: number): Promise<void> {
    return this.remote.remove(catalog, id);
  }

  listAiModels(): Promise<AiModel[]> {
    return this.local.listAiModels();
  }

  updateAiModel(id: number, changes: { isActive?: boolean; isDefault?: boolean }): Promise<AiModel> {
    return this.local.updateAiModel(id, changes);
  }
}
