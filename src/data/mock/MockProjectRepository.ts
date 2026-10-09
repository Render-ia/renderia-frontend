import { ApiError } from '../../core/http/ApiError.ts';
import type { Project, ProjectInput } from '../../models/Project.ts';
import type { ProjectRepository } from '../repositories.ts';
import { latency, MockDatabase, now } from './MockDatabase.ts';

export class MockProjectRepository implements ProjectRepository {
  private readonly db = MockDatabase.getInstance();

  async findAll(ownerId?: number): Promise<Project[]> {
    await latency();
    return this.db
      .table('projects')
      .filter((p) => ownerId === undefined || p.userId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findById(id: number): Promise<Project | null> {
    await latency();
    return this.db.table('projects').find((p) => p.id === id) ?? null;
  }

  async create(ownerId: number, input: ProjectInput): Promise<Project> {
    await latency();
    const timestamp = now();
    return this.db.insert('projects', {
      id: this.db.nextId('projects'),
      userId: ownerId,
      ...this.clean(input),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async update(id: number, input: ProjectInput): Promise<Project> {
    await latency();
    const project = this.db.table('projects').find((p) => p.id === id);
    if (!project) throw new ApiError('El proyecto no existe.', 404);
    Object.assign(project, this.clean(input), { updatedAt: now() });
    this.db.save();
    return project;
  }

  /** Deletes the project and, like ON DELETE CASCADE, everything under it. */
  async remove(id: number): Promise<void> {
    await latency();
    const planIds = this.db
      .table('floorPlans')
      .filter((f) => f.projectId === id)
      .map((f) => f.id);
    const analysisIds = this.db
      .table('analyses')
      .filter((a) => planIds.includes(a.floorPlanId))
      .map((a) => a.id);

    const keep = <T>(rows: T[], predicate: (row: T) => boolean): void => {
      const kept = rows.filter(predicate);
      rows.splice(0, rows.length, ...kept);
    };
    keep(this.db.table('elements'), (e) => !analysisIds.includes(e.aiAnalysisId));
    keep(this.db.table('models3d'), (m) => !planIds.includes(m.floorPlanId));
    keep(this.db.table('analyses'), (a) => !analysisIds.includes(a.id));
    keep(this.db.table('floorPlans'), (f) => f.projectId !== id);
    keep(this.db.table('projects'), (p) => p.id !== id);
    this.db.save();
  }

  private clean(input: ProjectInput): ProjectInput {
    return {
      name: input.name.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      buildingTypeId: input.buildingTypeId,
    };
  }
}
