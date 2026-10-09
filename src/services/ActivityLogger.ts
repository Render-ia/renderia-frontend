import { Session } from '../auth/Session.ts';
import { appEvents } from '../core/events/AppEvents.ts';
import { repositories } from '../data/dataSource.ts';

/**
 * Writes the `activity` events published anywhere in the app into
 * activity_logs.
 *
 * Pattern: Observer — the logger subscribes once; the code that does the work
 * only publishes an event and does not know the log exists.
 */
export class ActivityLogger {
  private unsubscribe: (() => void) | null = null;

  start(): void {
    this.unsubscribe = appEvents.on('activity', ({ action, details }) => {
      const userId = Session.getInstance().user?.id ?? null;
      repositories()
        .activity()
        .create(userId, action, details)
        .catch(() => {
          // Losing a log line must never break what the user is doing.
        });
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

/** Shortcut used by services to report an action. */
export function logActivity(action: string, details: string): void {
  appEvents.emit('activity', { action, details });
}
