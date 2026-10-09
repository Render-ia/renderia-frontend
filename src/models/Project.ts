/** Row of the `projects` table. */
export interface Project {
  id: number;
  userId: number;
  buildingTypeId: number | null;
  name: string;
  description: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Pick<Project, 'name' | 'description' | 'location' | 'buildingTypeId'>;
