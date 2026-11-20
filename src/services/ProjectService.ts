import { Session } from '../auth/Session.ts';
import { ApiError } from '../core/http/ApiError.ts';
import { repositories } from '../data/dataSource.ts';
import type { Project, ProjectInput } from '../models/Project.ts';
import type { ProjectMember } from '../models/ProjectMember.ts';
import { logActivity } from './ActivityLogger.ts';

/** Projects the current user can see and change, following the role policy. */
export class ProjectService {
  private readonly session = Session.getInstance();
  private readonly repo = repositories().projects();

  /** Admins and reviewers see every project; everyone else sees their own and the shared ones. */
  listVisible(): Promise<Project[]> {
    const user = this.requireUser();
    return this.session.can('projects:view-all') ? this.repo.findAll() : this.repo.findAccessible(user.id);
  }

  async get(id: number): Promise<Project> {
    const project = await this.repo.findById(id);
    if (!project || !(await this.canSee(project))) {
      throw new ApiError('El proyecto no existe o no tienes acceso a él.', 404);
    }
    return project;
  }

  async canSee(project: Project): Promise<boolean> {
    if (project.userId === this.session.user?.id || this.session.can('projects:view-all')) return true;
    const members = await this.repo.members(project.id);
    return members.some((m) => m.userId === this.session.user?.id);
  }

  /** True when the project belongs to someone else and was shared with the current user. */
  isSharedWithMe(project: Project): boolean {
    return project.userId !== this.session.user?.id && !this.session.can('projects:view-all');
  }

  canShare(project: Project): boolean {
    return project.userId === this.session.user?.id && this.session.can('projects:share');
  }

  members(project: Project): Promise<ProjectMember[]> {
    return this.repo.members(project.id);
  }

  async share(project: Project, email: string): Promise<ProjectMember> {
    if (!this.canShare(project)) throw new ApiError('Solo el dueño del proyecto puede compartirlo.', 403);
    const member = await this.repo.share(project.id, email);
    logActivity('Proyecto compartido', `Se compartió "${project.name}" con ${member.fullName}.`);
    return member;
  }

  async unshare(project: Project, member: ProjectMember): Promise<void> {
    if (!this.canShare(project)) throw new ApiError('Solo el dueño del proyecto puede dejar de compartirlo.', 403);
    await this.repo.unshare(project.id, member.userId);
    logActivity('Proyecto sin compartir', `${member.fullName} ya no ve "${project.name}".`);
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
    const limit = this.session.policy.projectLimit();
    if (limit <= 0) throw new ApiError('Tu rol no permite crear proyectos.', 403);
    if ((await this.remainingSlots()) <= 0) {
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
