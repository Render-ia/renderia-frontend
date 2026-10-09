/** Error raised when the backend cannot be reached or answers with a failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the request never reached the server (offline, CORS, DNS...). */
  get isNetworkError(): boolean {
    return this.status === null;
  }
}
