import type { Model3D } from '../../models/Model3D.ts';
import type { Model3DRepository } from '../repositories.ts';
import { latency, MockDatabase, now } from './MockDatabase.ts';

export class MockModel3DRepository implements Model3DRepository {
  private readonly db = MockDatabase.getInstance();

  async findAll(): Promise<Model3D[]> {
    await latency();
    return [...this.db.table('models3d')].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findByAnalysis(analysisId: number): Promise<Model3D | null> {
    return this.db.table('models3d').find((m) => m.aiAnalysisId === analysisId) ?? null;
  }

  async create(input: Omit<Model3D, 'id' | 'createdAt'>): Promise<Model3D> {
    return this.db.insert('models3d', { id: this.db.nextId('models3d'), ...input, createdAt: now() });
  }
}
