import { AppConfig } from '../config/AppConfig.ts';
import { ApiError } from './ApiError.ts';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Single HTTP client for talking to the Java backend.
 *
 * Pattern: Singleton — every service shares the same client, so the base URL,
 * headers and error handling live in one place.
 */
export class ApiClient {
  private static instance: ApiClient | null = null;

  private readonly baseUrl: string;
  private tokenProvider: () => string | null = () => null;

  private constructor() {
    this.baseUrl = AppConfig.getInstance().apiUrl;
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /** Lets the session module supply the bearer token for every request. */
  setTokenProvider(provider: () => string | null): void {
    this.tokenProvider = provider;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  /** Sends a multipart form (used to upload floor plan files). */
  upload<T>(path: string, form: FormData): Promise<T> {
    return this.request<T>('POST', path, form);
  }

  private async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    const token = this.tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { method, headers, body: payload });
    } catch {
      throw new ApiError('No se pudo conectar con el servidor.', null);
    }

    if (!response.ok) {
      throw new ApiError(await this.errorMessage(response), response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  /** Uses the backend's `message` field when it sends one. */
  private async errorMessage(response: Response): Promise<string> {
    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) return data.message;
    } catch {
      // Body was not JSON.
    }
    if (response.status === 401) return 'Tu sesión no es válida. Inicia sesión de nuevo.';
    if (response.status === 403) return 'No tienes permiso para hacer esto.';
    if (response.status === 404) return 'No se encontró lo que buscabas.';
    return `El servidor respondió con el código ${response.status}.`;
  }
}
