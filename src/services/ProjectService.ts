import { Session } from '../auth/Session.ts';
import { ApiError } from '../core/http/ApiError.ts';
import { repositories } from '../data/dataSource.ts';
import type { Project, ProjectInput } from '../models/Project.ts';
import { logActivity } from './ActivityLogger.ts';

/** Projects the current user can see and change, following the role policy. */
export class ProjectService {
  private readonly session = Session.getInstance();
  private readonly repo = repositories().projects();

  /** Admins see every project; everyone else sees their own. */
  listVisible(): Promise<Project[]> {
    const user = this.requireUser();
    return this.session.can('projects:view-all') ? this.repo.findAll() : this.repo.findAll(user.id);
  }

  async get(id: number): Promise<Project> {
    const project = await this.repo.findById(id);
    if (!project || !this.canSee(project)) {
      throw new ApiError('El proyecto no existe o no tienes acceso a él.', 404);
    }
    return project;
  }

  canSee(project: Project): boolean {
    return project.userId === this.session.user?.id || this.session.can('projects:view-all');
  }

  canManage(project: Project): boolean {
    return project.userId === this.session.user?.id || this.session.can('projects:manage-any');
  }

  /** How many more projects the user may create (Infinity when unlimited). */
  async remainingSlots(): Promise<number> {
    const user = this.requireUser();
    const own = await this.repo.findAll(user.id);
    return this.session.policy.projectLimit() - own.length;
  }

  async create(input: ProjectInput): Promise<Project> {
    const user = this.requireUser();
    if ((await this.remainingSlots()) <= 0) {
      const limit = this.session.policy.projectLimit();
      throw new ApiError(`Tu rol permite máximo ${limit} proyectos. Elimina uno para crear otro.`, 403);
    }
    const project = await this.repo.create(user.id, input);
    logActivity('Proyecto creado', `Se creó el proyecto "${project.name}".`);
    return project;
  }

  async update(project: Project, input: ProjectInput): Promise<Project> {
    this.assertCanManage(project);
    const updated = await this.repo.update(project.id, input);
    logActivity('Proyecto actualizado', `Se actualizó el proyecto "${updated.name}".`);
    return updated;
  }

  async remove(project: Project): Promise<void> {
    this.assertCanManage(project);
    await this.repo.remove(project.id);
    logActivity('Proyecto eliminado', `Se eliminó el proyecto "${project.name}".`);
  }

  private assertCanManage(project: Project): void {
    if (!this.canManage(project)) {
      throw new ApiError('Solo el dueño del proyecto puede modificarlo.', 403);
    }
  }

  private requireUser() {
    const user = this.session.user;
    if (!user) throw new ApiError('Inicia sesión para continuar.', 401);
    return user;
  }
}
