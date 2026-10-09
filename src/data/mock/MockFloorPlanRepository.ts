import type { FloorPlan, FloorPlanInput } from '../../models/FloorPlan.ts';
import type { FloorPlanRepository, PreparedImage } from '../repositories.ts';
import { latency, MockDatabase, now } from './MockDatabase.ts';

export class MockFloorPlanRepository implements FloorPlanRepository {
  private readonly db = MockDatabase.getInstance();

  async findAll(): Promise<FloorPlan[]> {
    await latency();
    return [...this.db.table('floorPlans')].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  async findByProject(projectId: number): Promise<FloorPlan[]> {
    await latency();
    return this.db
      .table('floorPlans')
      .filter((f) => f.projectId === projectId)
      .sort((a, b) => a.floorLevel - b.floorLevel);
  }

  async findById(id: number): Promise<FloorPlan | null> {
    return this.db.table('floorPlans').find((f) => f.id === id) ?? null;
  }

  async create(input: Omit<FloorPlanInput, 'fileUrl'>, image: PreparedImage): Promise<FloorPlan> {
    await latency(300);
    const plan: FloorPlan = {
      id: this.db.nextId('floorPlans'),
      ...input,
      fileUrl: image.dataUrl,
      uploadedAt: now(),
    };
    this.db.table('floorPlans').push(plan);
    try {
      this.db.save();
    } catch (error) {
      this.db.table('floorPlans').pop();
      throw error;
    }
    return plan;
  }

  async remove(id: number): Promise<void> {
    await latency();
    const analysisIds = this.db
      .table('analyses')
      .filter((a) => a.floorPlanId === id)
      .map((a) => a.id);

    const remove = <T>(rows: T[], predicate: (row: T) => boolean): void => {
      for (let i = rows.length - 1; i >= 0; i--) if (predicate(rows[i])) rows.splice(i, 1);
    };
    remove(this.db.table('elements'), (e) => analysisIds.includes(e.aiAnalysisId));
    remove(this.db.table('models3d'), (m) => m.floorPlanId === id);
    remove(this.db.table('analyses'), (a) => a.floorPlanId === id);
    remove(this.db.table('floorPlans'), (f) => f.id === id);
    this.db.save();
  }
}
