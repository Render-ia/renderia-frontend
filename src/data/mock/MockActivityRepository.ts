import type { ActivityLog } from '../../models/ActivityLog.ts';
import type { ActivityRepository } from '../repositories.ts';
import { MockDatabase, now } from './MockDatabase.ts';

/** Keeps the last entries only, so the browser storage does not fill up. */
const MAX_ENTRIES = 300;

export class MockActivityRepository implements ActivityRepository {
  private readonly db = MockDatabase.getInstance();

  async findRecent(limit: number, userId?: number): Promise<ActivityLog[]> {
    return this.db
      .table('activity')
      .filter((log) => userId === undefined || log.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      .slice(0, limit);
  }

  async create(userId: number | null, action: string, details: string): Promise<ActivityLog> {
    const log = this.db.insert('activity', {
      id: this.db.nextId('activity'),
      userId,
      action,
      details,
      createdAt: now(),
    });
    const rows = this.db.table('activity');
    if (rows.length > MAX_ENTRIES) {
      rows.splice(0, rows.length - MAX_ENTRIES);
      this.db.save();
    }
    return log;
  }
}
