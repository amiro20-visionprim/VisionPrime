/**
 * The only sanctioned way for any Admin OS / Customer Club page to call
 * the API. No page should ever call `fetch` directly — see
 * /docs/ui-ux-guidelines.md and /docs/definition-of-done.md.
 */
export interface ApiClientConfig {
  baseUrl: string;
  /**
   * Optional callback returning extra headers (e.g. `Authorization:
   * Bearer <token>`) to merge into every request. Re-read on each call
   * so a refreshed token is picked up without re-constructing the
   * client.
   */
  getAuthHeader?: () => Record<string, string>;
}

export interface ApiSuccessShape<T> {
  success: true;
  data: T;
  meta: Record<string, unknown>;
}

export interface ApiErrorShape {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResult<T> = ApiSuccessShape<T> | ApiErrorShape;

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(error: ApiErrorShape["error"]) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.details = error.details;
  }
}

export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  /**
   * Like `get`, but resolves with the full `{data, meta}` envelope
   * instead of just `data` — used by paginated list views that need
   * `meta.page` / `meta.totalItems` / etc. alongside the rows.
   */
  async getWithMeta<T>(path: string): Promise<ApiSuccessShape<T>> {
    return this.requestEnvelope<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const payload = await this.requestEnvelope<T>(path, init);
    return payload.data;
  }

  private async requestEnvelope<T>(path: string, init: RequestInit): Promise<ApiSuccessShape<T>> {
    const authHeaders = this.config.getAuthHeader ? this.config.getAuthHeader() : {};
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...authHeaders,
      },
    });
    const payload = (await response.json()) as ApiResult<T>;

    if (!payload.success) {
      throw new ApiClientError(payload.error);
    }

    return payload;
  }
}
