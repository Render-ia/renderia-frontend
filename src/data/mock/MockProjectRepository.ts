import { ApiError } from '../../core/http/ApiError.ts';
import type { Project, ProjectInput } from '../../models/Project.ts';
import type { ProjectMember } from '../../models/ProjectMember.ts';
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

  async findAccessible(userId: number): Promise<Project[]> {
    const shared = new Set(
      this.db
        .table('projectMembers')
        .filter((m) => m.userId === userId)
        .map((m) => m.projectId),
    );
    const all = await this.findAll();
    return all.filter((p) => p.userId === userId || shared.has(p.id));
  }

  async members(projectId: number): Promise<ProjectMember[]> {
    await latency();
    return this.db
      .table('projectMembers')
      .filter((m) => m.projectId === projectId)
      .flatMap((m) => {
        const user = this.db.table('users').find((u) => u.id === m.userId);
        const role = user && this.db.table('roles').find((r) => r.id === user.roleId);
        return user && role
          ? [{ userId: user.id, fullName: user.fullName, email: user.email, role: role.name, sharedAt: m.createdAt }]
          : [];
      });
  }

  async share(projectId: number, email: string): Promise<ProjectMember> {
    await latency();
    const project = this.db.table('projects').find((p) => p.id === projectId);
    if (!project) throw new ApiError('El proyecto no existe.', 404);
    const user = this.db.table('users').find((u) => u.email === email.trim().toLowerCase() && u.isActive);
    if (!user) throw new ApiError('No hay una cuenta activa con ese correo.', 404);
    if (user.id === project.userId) throw new ApiError('El proyecto ya es de esa persona.', 400);
    const members = this.db.table('projectMembers');
    if (members.some((m) => m.projectId === projectId && m.userId === user.id)) {
      throw new ApiError('El proyecto ya está compartido con esa persona.', 409);
    }
    this.db.insert('projectMembers', { id: this.db.nextId('projectMembers'), projectId, userId: user.id, createdAt: now() });
    return (await this.members(projectId)).find((m) => m.userId === user.id)!;
  }

  async unshare(projectId: number, userId: number): Promise<void> {
    await latency();
    const members = this.db.table('projectMembers');
    const index = members.findIndex((m) => m.projectId === projectId && m.userId === userId);
    if (index < 0) throw new ApiError('El proyecto no está compartido con esa persona.', 404);
    members.splice(index, 1);
    this.db.save();
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
    keep(this.db.table('projectMembers'), (m) => m.projectId !== id);
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
