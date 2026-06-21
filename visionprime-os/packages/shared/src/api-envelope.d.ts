import { ErrorCode } from "./error-codes";
export interface ApiSuccess<T = unknown> {
    success: true;
    data: T;
    meta: Record<string, unknown>;
}
export interface ApiError {
    success: false;
    error: {
        code: ErrorCode | string;
        message: string;
        details?: Record<string, unknown>;
    };
}
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
export interface PaginationMeta {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}
