import { EventBus } from './EventBus.ts';

/** Events shared across the whole application. */
export type AppEventMap = {
  'route:changed': { path: string };
  'backend:status': { online: boolean };
};

export const appEvents = new EventBus<AppEventMap>();
