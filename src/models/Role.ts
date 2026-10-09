/** Names of the roles seeded in the `roles` table. */
export type RoleName = 'Administrador' | 'Ingeniero' | 'Estudiante';

/** Row of the `roles` table. */
export interface Role {
  id: number;
  name: RoleName;
  description: string;
}
