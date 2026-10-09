import { ApiError } from '../../core/http/ApiError.ts';
import type { AiAnalysis } from '../../models/AiAnalysis.ts';
import type { StructuralElement, StructuralElementInput } from '../../models/StructuralElement.ts';
import type { AnalysisRepository } from '../repositories.ts';
import { latency, MockDatabase, now } from './MockDatabase.ts';

export class MockAnalysisRepository implements AnalysisRepository {
  private readonly db = MockDatabase.getInstance();

  async findAll(): Promise<AiAnalysis[]> {
    await latency();
    return [...this.db.table('analyses')].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: number): Promise<AiAnalysis | null> {
    return this.db.table('analyses').find((a) => a.id === id) ?? null;
  }

  async create(floorPlanId: number, aiModelId: number): Promise<AiAnalysis> {
    return this.db.insert('analyses', {
      id: this.db.nextId('analyses'),
      floorPlanId,
      aiModelId,
      status: 'PENDING',
      rawResponse: null,
      errorMessage: null,
      durationMs: null,
      createdAt: now(),
    });
  }

  async update(id: number, changes: Partial<Omit<AiAnalysis, 'id'>>): Promise<AiAnalysis> {
    const analysis = this.db.table('analyses').find((a) => a.id === id);
    if (!analysis) throw new ApiError('El análisis no existe.', 404);
    Object.assign(analysis, changes);
    this.db.save();
    return analysis;
  }

  async remove(id: number): Promise<void> {
    await latency();
    const keep = <T>(rows: T[], predicate: (row: T) => boolean): void => {
      rows.splice(0, rows.length, ...rows.filter(predicate));
    };
    keep(this.db.table('elements'), (e) => e.aiAnalysisId !== id);
    keep(this.db.table('models3d'), (m) => m.aiAnalysisId !== id);
    keep(this.db.table('analyses'), (a) => a.id !== id);
    this.db.save();
  }

  async findElements(analysisId: number): Promise<StructuralElement[]> {
    await latency();
    return this.db.table('elements').filter((e) => e.aiAnalysisId === analysisId);
  }

  async saveElements(analysisId: number, elements: StructuralElementInput[]): Promise<StructuralElement[]> {
    const table = this.db.table('elements');
    let nextId = this.db.nextId('elements');
    const saved = elements.map((element) => ({ id: nextId++, aiAnalysisId: analysisId, ...element }));
    table.push(...saved);
    this.db.save();
    return saved;
  }

  async updateElement(
    id: number,
    changes: { elementTypeId?: number; materialId?: number | null },
  ): Promise<StructuralElement> {
    await latency(60);
    const element = this.db.table('elements').find((e) => e.id === id);
    if (!element) throw new ApiError('El elemento no existe.', 404);
    Object.assign(element, changes);
    this.db.save();
    return element;
  }

  async removeElement(id: number): Promise<void> {
    await latency(60);
    const rows = this.db.table('elements');
    const index = rows.findIndex((e) => e.id === id);
    if (index >= 0) rows.splice(index, 1);
    this.db.save();
  }
}
