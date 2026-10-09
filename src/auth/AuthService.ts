import { repositories } from '../data/dataSource.ts';
import type { RegisterData, UserWithRole } from '../models/User.ts';
import { logActivity } from '../services/ActivityLogger.ts';
import { Session } from './Session.ts';

/** Login, registration and logout. Keeps the Session up to date. */
export class AuthService {
  private readonly session = Session.getInstance();

  async login(email: string, password: string): Promise<UserWithRole> {
    const { token, user } = await repositories().auth().login(email, password);
    this.session.start(token, user);
    logActivity('Inicio de sesión', `${user.fullName} entró a la plataforma.`);
    return user;
  }

  async register(data: RegisterData): Promise<UserWithRole> {
    const { token, user } = await repositories().auth().register(data);
    this.session.start(token, user);
    logActivity('Registro', `${user.fullName} creó su cuenta como ${user.role.name}.`);
    return user;
  }

  logout(): void {
    const name = this.session.user?.fullName;
    if (name) logActivity('Cierre de sesión', `${name} salió de la plataforma.`);
    this.session.clear();
  }
}
