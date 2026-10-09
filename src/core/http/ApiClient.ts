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

  private constructor() {
    this.baseUrl = AppConfig.getInstance().apiUrl;
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
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

  private async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('No se pudo conectar con el servidor.', null);
    }

    if (!response.ok) {
      throw new ApiError(`El servidor respondió con el código ${response.status}.`, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}
