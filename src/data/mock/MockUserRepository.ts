import { ApiError } from '../../core/http/ApiError.ts';
import type { Role } from '../../models/Role.ts';
import type { UserWithRole } from '../../models/User.ts';
import type { UserRepository } from '../repositories.ts';
import { toUserWithRole } from './MockAuthRepository.ts';
import { latency, MockDatabase } from './MockDatabase.ts';

export class MockUserRepository implements UserRepository {
  private readonly db = MockDatabase.getInstance();

  async findAll(): Promise<UserWithRole[]> {
    await latency();
    return this.db.table('users').map((row) => toUserWithRole(this.db, row));
  }

  async update(id: number, changes: { roleId?: number; isActive?: boolean }): Promise<UserWithRole> {
    await latency();
    const row = this.db.table('users').find((u) => u.id === id);
    if (!row) throw new ApiError('El usuario no existe.', 404);

    if (changes.roleId !== undefined) row.roleId = changes.roleId;
    if (changes.isActive !== undefined) row.isActive = changes.isActive;

    const admins = this.db.table('users').filter((u) => u.roleId === 1 && u.isActive);
    if (admins.length === 0) {
      throw new ApiError('Debe quedar al menos un administrador activo.', 400);
    }
    this.db.save();
    return toUserWithRole(this.db, row);
  }

  async listRoles(): Promise<Role[]> {
    return [...this.db.table('roles')];
  }
}
