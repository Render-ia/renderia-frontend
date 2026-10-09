import { ApiError } from '../../core/http/ApiError.ts';
import type { RegisterData, UserWithRole } from '../../models/User.ts';
import { randomToken, sha256Hex } from '../../utils/crypto.ts';
import type { AuthRepository, AuthResult } from '../repositories.ts';
import { latency, MockDatabase, now, type UserRow } from './MockDatabase.ts';

/** Turns a stored row into the public user shape (drops the password hash). */
export function toUserWithRole(db: MockDatabase, row: UserRow): UserWithRole {
  const { passwordHash: _hash, ...user } = row;
  const role = db.table('roles').find((r) => r.id === row.roleId)!;
  return { ...user, role };
}

export class MockAuthRepository implements AuthRepository {
  private readonly db = MockDatabase.getInstance();

  async login(email: string, password: string): Promise<AuthResult> {
    await latency(250);
    const normalized = email.trim().toLowerCase();
    const row = this.db.table('users').find((u) => u.email === normalized);
    const hash = await sha256Hex(`${normalized}:${password}`);

    if (!row || row.passwordHash !== hash) {
      throw new ApiError('El correo o la contraseña no son correctos.', 401);
    }
    if (!row.isActive) {
      throw new ApiError('Tu cuenta está desactivada. Habla con un administrador.', 403);
    }
    return this.openSession(row);
  }

  async register(data: RegisterData): Promise<AuthResult> {
    await latency(250);
    const email = data.email.trim().toLowerCase();
    if (this.db.table('users').some((u) => u.email === email)) {
      throw new ApiError('Ya existe una cuenta con ese correo.', 409);
    }
    const role = this.db.table('roles').find((r) => r.id === data.roleId);
    if (!role || role.name === 'Administrador') {
      throw new ApiError('Elige un rol válido: Ingeniero o Estudiante.', 400);
    }

    const row: UserRow = {
      id: this.db.nextId('users'),
      roleId: role.id,
      fullName: data.fullName.trim(),
      email,
      passwordHash: await sha256Hex(`${email}:${data.password}`),
      isActive: true,
      createdAt: now(),
    };
    this.db.insert('users', row);
    return this.openSession(row);
  }

  async me(token: string): Promise<UserWithRole | null> {
    const session = this.db.table('sessions').find((s) => s.token === token);
    const row = session && this.db.table('users').find((u) => u.id === session.userId);
    return row && row.isActive ? toUserWithRole(this.db, row) : null;
  }

  private openSession(row: UserRow): AuthResult {
    const token = randomToken();
    this.db.table('sessions').push({ token, userId: row.id });
    this.db.save();
    return { token, user: toUserWithRole(this.db, row) };
  }
}
