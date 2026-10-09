import { ApiClient } from '../../core/http/ApiClient.ts';
import type { ActivityLog } from '../../models/ActivityLog.ts';
import type { ActivityRepository } from '../repositories.ts';

/** /activity-logs */
export class ApiActivityRepository implements ActivityRepository {
  private readonly api = ApiClient.getInstance();

  findRecent(limit: number, userId?: number): Promise<ActivityLog[]> {
    const user = userId === undefined ? '' : `&userId=${userId}`;
    return this.api.get<ActivityLog[]>(`/activity-logs?limit=${limit}${user}`);
  }

  create(_userId: number | null, action: string, details: string): Promise<ActivityLog> {
    return this.api.post<ActivityLog>('/activity-logs', { action, details });
  }
}
