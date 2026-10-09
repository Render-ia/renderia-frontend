/** Row of the `activity_logs` table. */
export interface ActivityLog {
  id: number;
  userId: number | null;
  action: string;
  details: string;
  createdAt: string;
}
