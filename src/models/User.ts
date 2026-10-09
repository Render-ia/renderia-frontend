import type { Role } from './Role.ts';

/** Row of the `users` table, without the password hash. */
export interface User {
  id: number;
  roleId: number;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

/** User together with its role, as the rest of the app needs it. */
export interface UserWithRole extends User {
  role: Role;
}

export interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  roleId: number;
}
