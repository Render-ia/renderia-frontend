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

  private constructor() {
    const fromEnv = import.meta.env.VITE_API_URL;
    this.apiUrl = (fromEnv || '/api/v1').replace(/\/+$/, '');
  }

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }
}
