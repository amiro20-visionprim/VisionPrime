/**
 * Throwable error carrying everything the global error filter needs to
 * produce a standard error envelope. Business/module code should throw
 * this (or a subclass) instead of sending responses directly.
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Resource not found", details?: Record<string, unknown>) {
    super(404, "NOT_FOUND", message, details);
  }
}
