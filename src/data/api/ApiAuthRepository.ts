import { ApiClient } from '../../core/http/ApiClient.ts';
import { ApiError } from '../../core/http/ApiError.ts';
import type { RegisterData, UserWithRole } from '../../models/User.ts';
import type { AuthRepository, AuthResult } from '../repositories.ts';

/** POST /auth/login, POST /auth/register, GET /auth/me */
export class ApiAuthRepository implements AuthRepository {
  private readonly api = ApiClient.getInstance();

  login(email: string, password: string): Promise<AuthResult> {
    return this.api.post<AuthResult>('/auth/login', { email, password });
  }

  register(data: RegisterData): Promise<AuthResult> {
    return this.api.post<AuthResult>('/auth/register', data);
  }

  async me(_token: string): Promise<UserWithRole | null> {
    try {
      return await this.api.get<UserWithRole>('/auth/me');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  }
}
