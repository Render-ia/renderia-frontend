/** A user a project is shared with (read access). */
export interface ProjectMember {
  userId: number;
  fullName: string;
  email: string;
  role: string;
  sharedAt: string;
}
