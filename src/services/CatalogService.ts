import { repositories } from '../data/dataSource.ts';
import type { AiModel, CatalogItem, CatalogName } from '../models/Catalog.ts';

export interface Catalogs {
  buildingTypes: CatalogItem[];
  elementTypes: CatalogItem[];
  materials: CatalogItem[];
  aiModels: AiModel[];
}

/**
 * Catalogs rarely change, so they are loaded once and shared.
 * Pattern: Singleton with a cached promise; `invalidate()` after admin edits.
 */
export class CatalogService {
  private static instance: CatalogService | null = null;
  private cache: Promise<Catalogs> | null = null;

  static getInstance(): CatalogService {
    if (!CatalogService.instance) {
      CatalogService.instance = new CatalogService();
    }
    return CatalogService.instance;
  }

  load(): Promise<Catalogs> {
    if (!this.cache) {
      const repo = repositories().catalogs();
      this.cache = Promise.all([
        repo.list('building-types'),
        repo.list('element-types'),
        repo.list('materials'),
        repo.listAiModels(),
      ]).then(([buildingTypes, elementTypes, materials, aiModels]) => ({
        buildingTypes,
        elementTypes,
        materials,
        aiModels,
      }));
      this.cache.catch(() => (this.cache = null));
    }
    return this.cache;
  }

  invalidate(): void {
    this.cache = null;
  }

  async list(catalog: CatalogName): Promise<CatalogItem[]> {
    const catalogs = await this.load();
    if (catalog === 'building-types') return catalogs.buildingTypes;
    if (catalog === 'element-types') return catalogs.elementTypes;
    return catalogs.materials;
  }
}

/** Finds a catalog name by id, with a fallback text. */
export function nameOf(items: { id: number; name: string }[], id: number | null, fallback = '—'): string {
  return items.find((item) => item.id === id)?.name ?? fallback;
}
