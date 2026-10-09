import { ApiError } from '../../core/http/ApiError.ts';
import type { AiModel, CatalogItem, CatalogName } from '../../models/Catalog.ts';
import type { CatalogRepository } from '../repositories.ts';
import { latency, MockDatabase } from './MockDatabase.ts';

const TABLES = {
  'building-types': 'buildingTypes',
  'element-types': 'elementTypes',
  materials: 'materials',
} as const;

export class MockCatalogRepository implements CatalogRepository {
  private readonly db = MockDatabase.getInstance();

  async list(catalog: CatalogName): Promise<CatalogItem[]> {
    return [...this.db.table(TABLES[catalog])];
  }

  async create(catalog: CatalogName, input: Omit<CatalogItem, 'id'>): Promise<CatalogItem> {
    await latency();
    this.assertUniqueName(catalog, input.name);
    const item = { id: this.db.nextId(TABLES[catalog]), ...input };
    return this.db.insert(TABLES[catalog], item);
  }

  async update(catalog: CatalogName, id: number, input: Omit<CatalogItem, 'id'>): Promise<CatalogItem> {
    await latency();
    const item = this.db.table(TABLES[catalog]).find((row) => row.id === id);
    if (!item) throw new ApiError('El registro no existe.', 404);
    this.assertUniqueName(catalog, input.name, id);
    Object.assign(item, input);
    this.db.save();
    return item;
  }

  async remove(catalog: CatalogName, id: number): Promise<void> {
    await latency();
    if (this.isInUse(catalog, id)) {
      throw new ApiError('No se puede eliminar porque hay registros que lo usan.', 409);
    }
    const rows = this.db.table(TABLES[catalog]);
    rows.splice(rows.findIndex((row) => row.id === id), 1);
    this.db.save();
  }

  async listAiModels(): Promise<AiModel[]> {
    return [...this.db.table('aiModels')];
  }

  async updateAiModel(id: number, changes: { isActive?: boolean; isDefault?: boolean }): Promise<AiModel> {
    await latency();
    const models = this.db.table('aiModels');
    const model = models.find((m) => m.id === id);
    if (!model) throw new ApiError('El modelo no existe.', 404);

    if (changes.isDefault) {
      models.forEach((m) => (m.isDefault = false));
      model.isDefault = true;
      model.isActive = true;
    }
    if (changes.isActive !== undefined) {
      if (!changes.isActive && model.isDefault) {
        throw new ApiError('No puedes desactivar el modelo predeterminado.', 400);
      }
      model.isActive = changes.isActive;
    }
    this.db.save();
    return model;
  }

  private assertUniqueName(catalog: CatalogName, name: string, exceptId?: number): void {
    const taken = this.db
      .table(TABLES[catalog])
      .some((row) => row.id !== exceptId && row.name.toLowerCase() === name.trim().toLowerCase());
    if (taken) throw new ApiError('Ya existe un registro con ese nombre.', 409);
  }

  private isInUse(catalog: CatalogName, id: number): boolean {
    if (catalog === 'building-types') {
      return this.db.table('projects').some((p) => p.buildingTypeId === id);
    }
    if (catalog === 'element-types') {
      return this.db.table('elements').some((e) => e.elementTypeId === id);
    }
    return this.db.table('elements').some((e) => e.materialId === id);
  }
}
