import type { Permission, RolePolicy } from './RolePolicy.ts';

/** Administrators can do everything. */
export class AdminPolicy implements RolePolicy {
  readonly role = 'Administrador' as const;

  can(_permission: Permission): boolean {
    return true;
  }

  projectLimit(): number {
    return Number.POSITIVE_INFINITY;
  }
}

/** Engineers work on their own projects without limits. */
export class EngineerPolicy implements RolePolicy {
  readonly role = 'Ingeniero' as const;
  private readonly allowed: Permission[] = ['models:export', 'elements:edit'];

  can(permission: Permission): boolean {
    return this.allowed.includes(permission);
  }

  projectLimit(): number {
    return Number.POSITIVE_INFINITY;
  }
}

/** Students use the platform for learning: a few projects and no exports. */
export class StudentPolicy implements RolePolicy {
  readonly role = 'Estudiante' as const;
  static readonly MAX_PROJECTS = 3;

  can(permission: Permission): boolean {
    return permission === 'elements:edit';
  }

  projectLimit(): number {
    return StudentPolicy.MAX_PROJECTS;
  }
}

/** Picks the strategy that matches a role name. Unknown roles get the most limited one. */
export function policyFor(roleName: string): RolePolicy {
  switch (roleName) {
    case 'Administrador':
      return new AdminPolicy();
    case 'Ingeniero':
      return new EngineerPolicy();
    default:
      return new StudentPolicy();
  }
}
