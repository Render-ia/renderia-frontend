import { ApiClient } from '../../core/http/ApiClient.ts';
import { ApiError } from '../../core/http/ApiError.ts';
import type { Project, ProjectInput } from '../../models/Project.ts';
import type { ProjectRepository } from '../repositories.ts';

/** /projects */
export class ApiProjectRepository implements ProjectRepository {
  private readonly api = ApiClient.getInstance();

  findAll(ownerId?: number): Promise<Project[]> {
    const query = ownerId === undefined ? '' : `?userId=${ownerId}`;
    return this.api.get<Project[]>(`/projects${query}`);
  }

  async findById(id: number): Promise<Project | null> {
    try {
      return await this.api.get<Project>(`/projects/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  create(_ownerId: number, input: ProjectInput): Promise<Project> {
    // The backend takes the owner from the session token.
    return this.api.post<Project>('/projects', input);
  }

  update(id: number, input: ProjectInput): Promise<Project> {
    return this.api.put<Project>(`/projects/${id}`, input);
  }

  remove(id: number): Promise<void> {
    return this.api.delete<void>(`/projects/${id}`);
  }
}
