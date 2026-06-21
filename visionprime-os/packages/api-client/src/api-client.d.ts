/**
 * The only sanctioned way for any Admin OS / Customer Club page to call
 * the API. No page should ever call `fetch` directly — see
 * /docs/ui-ux-guidelines.md and /docs/definition-of-done.md.
 */
export interface ApiClientConfig {
    baseUrl: string;
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
export declare class ApiClientError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown>;
    constructor(error: ApiErrorShape["error"]);
}
export declare class ApiClient {
    private readonly config;
    constructor(config: ApiClientConfig);
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    private request;
}
