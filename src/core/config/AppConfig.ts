/**
 * Application configuration.
 *
 * Pattern: Singleton — there is exactly one configuration object for the
 * whole app, created lazily and shared by every module that needs it.
 */
export class AppConfig {
  private static instance: AppConfig | null = null;

  readonly appName = 'Render.IA';
  readonly apiUrl: string;
  /** "mock" keeps all data in the browser; "api" uses the Java backend. */
  readonly dataSource: 'mock' | 'api';

  private constructor() {
    const fromEnv = import.meta.env.VITE_API_URL;
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const fallback = isLocal ? '/api/v1' : 'https://renderia-backend.onrender.com/api/v1';
    this.apiUrl = (fromEnv || fallback).replace(/\/+$/, '');
    this.dataSource = import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock';
  }

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }
}