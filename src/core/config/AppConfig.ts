/**
 * Application configuration.
 *
 * Pattern: Singleton — there is exactly one configuration object for the
 * whole app, created lazily and shared by every module that needs it.
 */
export type DataSource = 'mock' | 'hybrid' | 'api';

export class AppConfig {
  private static instance: AppConfig | null = null;

  readonly appName = 'Render.IA';
  readonly apiUrl: string;
  /**
   * "mock" keeps all data in the browser; "api" uses the Java backend for everything;
   * "hybrid" uses the backend for what it already serves and the browser for the rest.
   */
  readonly dataSource: DataSource;

  private constructor() {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    const fromEnv = import.meta.env.VITE_API_URL;
    const fallback = isLocal ? '/api/v1' : 'https://renderia-backend.onrender.com/api/v1';
    this.apiUrl = (fromEnv || fallback).replace(/\/+$/, '');

    const source = import.meta.env.VITE_DATA_SOURCE;
    if (source === 'mock' || source === 'hybrid' || source === 'api') {
      this.dataSource = source;
    } else {
      this.dataSource = isLocal ? 'mock' : 'hybrid';
    }
  }

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }
}
