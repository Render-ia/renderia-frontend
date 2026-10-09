import { ApiClient } from '../core/http/ApiClient.ts';

/** Shape returned by GET /api/v1/hello in renderia-backend. */
export interface HelloResponse {
  proyecto: string;
  descripcion: string;
  integrantes: string[];
  mensaje: string;
}

/** Checks the connection with the backend through its hello endpoint. */
export class HelloService {
  private readonly api = ApiClient.getInstance();

  getHello(): Promise<HelloResponse> {
    return this.api.get<HelloResponse>('/hello');
  }
}
