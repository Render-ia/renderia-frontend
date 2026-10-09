import type { RoleName } from '../models/Role.ts';

export type Permission =
  /** See projects of every user, not only one's own. */
  | 'projects:view-all'
  /** Edit or delete projects owned by someone else. */
  | 'projects:manage-any'
  /** Open the administration screen. */
  | 'admin:access'
  /** Download the 3D model as a GLB file. */
  | 'models:export'
  /** Correct the type or material of detected elements. */
  | 'elements:edit';

/**
 * Pattern: Strategy — each role is a strategy that answers what its users can
 * do. The rest of the app asks the current policy instead of checking role
 * names with if/else chains.
 */
export interface RolePolicy {
  readonly role: RoleName;
  can(permission: Permission): boolean;
  /** Maximum number of projects the user can own. */
  projectLimit(): number;
}
