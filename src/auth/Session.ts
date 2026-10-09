import { appEvents } from '../core/events/AppEvents.ts';
import { ApiClient } from '../core/http/ApiClient.ts';
import { LocalStore } from '../core/storage/LocalStore.ts';
import { repositories } from '../data/dataSource.ts';
import type { UserWithRole } from '../models/User.ts';
import { policyFor } from './policies.ts';
import type { Permission, RolePolicy } from './RolePolicy.ts';

const STORAGE_KEY = 'renderia.session';

/**
 * Holds who is logged in.
 *
 * Patterns: Singleton (one session for the app) and Observer (publishes
 * `session:changed` so the shell and views update themselves).
 */
export class Session {
  private static instance: Session | null = null;

  private token: string | null = null;
  private currentUser: UserWithRole | null = null;
  private currentPolicy: RolePolicy | null = null;

  private constructor() {
    ApiClient.getInstance().setTokenProvider(() => this.token);
  }

  static getInstance(): Session {
    if (!Session.instance) {
      Session.instance = new Session();
    }
    return Session.instance;
  }

  get user(): UserWithRole | null {
    return this.currentUser;
  }

  get isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  /** Strategy of the current role. Throws if nobody is logged in. */
  get policy(): RolePolicy {
    if (!this.currentPolicy) throw new Error('No hay una sesión activa.');
    return this.currentPolicy;
  }

  can(permission: Permission): boolean {
    return this.currentPolicy?.can(permission) ?? false;
  }

  /** Reopens the session saved in the browser, if it is still valid. */
  async restore(): Promise<void> {
    const saved = LocalStore.read<string | null>(STORAGE_KEY, null);
    if (!saved) return;
    this.token = saved;
    try {
      const user = await repositories().auth().me(saved);
      if (user) {
        this.apply(saved, user);
      } else {
        this.clear();
      }
    } catch {
      // Backend unreachable: keep the user logged out.
      this.clear();
    }
  }

  start(token: string, user: UserWithRole): void {
    LocalStore.write(STORAGE_KEY, token);
    this.apply(token, user);
  }

  clear(): void {
    LocalStore.remove(STORAGE_KEY);
    this.token = null;
    this.currentUser = null;
    this.currentPolicy = null;
    appEvents.emit('session:changed', { user: null });
  }

  private apply(token: string, user: UserWithRole): void {
    this.token = token;
    this.currentUser = user;
    this.currentPolicy = policyFor(user.role.name);
    appEvents.emit('session:changed', { user });
  }
}
