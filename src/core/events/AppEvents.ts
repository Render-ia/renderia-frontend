import { EventBus } from './EventBus.ts';
import type { AnalysisStatus } from '../../models/AiAnalysis.ts';
import type { UserWithRole } from '../../models/User.ts';

/** Events shared across the whole application. */
export type AppEventMap = {
  'route:changed': { path: string; pattern: string; isPublic: boolean };
  'backend:status': { online: boolean };
  'session:changed': { user: UserWithRole | null };
  /** The backend rejected the saved token; the user must log in again. */
  'session:expired': Record<string, never>;
  'analysis:status': { analysisId: number; status: AnalysisStatus; message?: string };
  /** Something worth writing in activity_logs happened. */
  activity: { action: string; details: string };
};

export const appEvents = new EventBus<AppEventMap>();
