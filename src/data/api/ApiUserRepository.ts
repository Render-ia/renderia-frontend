import { ApiClient } from '../../core/http/ApiClient.ts';
import type { Role } from '../../models/Role.ts';
import type { UserWithRole } from '../../models/User.ts';
import type { UserRepository } from '../repositories.ts';

/** GET /users, PUT /users/{id}, GET /roles */
export class ApiUserRepository implements UserRepository {
  private readonly api = ApiClient.getInstance();

  findAll(): Promise<UserWithRole[]> {
    return this.api.get<UserWithRole[]>('/users');
  }

  update(id: number, changes: { roleId?: number; isActive?: boolean }): Promise<UserWithRole> {
    return this.api.put<UserWithRole>(`/users/${id}`, changes);
  }

  listRoles(): Promise<Role[]> {
    return this.api.get<Role[]>('/roles');
  }
}
