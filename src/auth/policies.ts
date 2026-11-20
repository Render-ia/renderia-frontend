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
  private readonly allowed: Permission[] = ['models:export', 'elements:edit', 'projects:share'];

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
    return permission === 'elements:edit' || permission === 'projects:share';
  }

  projectLimit(): number {
    return StudentPolicy.MAX_PROJECTS;
  }
}

/** Reviewers see and sign off every project, but change nothing. */
export class ReviewerPolicy implements RolePolicy {
  readonly role = 'Revisor' as const;
  private readonly allowed: Permission[] = ['projects:view-all', 'analyses:review-any', 'models:export'];

  can(permission: Permission): boolean {
    return this.allowed.includes(permission);
  }

  projectLimit(): number {
    return 0;
  }
}

/** Clients only see the projects shared with them, in client mode. */
export class ClientPolicy implements RolePolicy {
  readonly role = 'Cliente' as const;

  can(_permission: Permission): boolean {
    return false;
  }

  projectLimit(): number {
    return 0;
  }
}

/** Picks the strategy that matches a role name. Unknown roles get the most limited one. */
export function policyFor(roleName: string): RolePolicy {
  switch (roleName) {
    case 'Administrador':
      return new AdminPolicy();
    case 'Ingeniero':
      return new EngineerPolicy();
    case 'Revisor':
      return new ReviewerPolicy();
    case 'Cliente':
      return new ClientPolicy();
    default:
      return new StudentPolicy();
  }
}
