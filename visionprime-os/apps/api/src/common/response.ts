import { Response } from "express";
import { ApiError, ApiSuccess } from "@visionprime/shared";

/**
 * Standard response helper. Every handler must send responses through
 * these two functions so the envelope shape is always consistent — see
 * /docs/api-conventions.md.
 */
export function sendSuccess<T>(res: Response, data: T, meta: Record<string, unknown> = {}, statusCode = 200): void {
  const body: ApiSuccess<T> = { success: true, data, meta };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: Record<string, unknown>,
): void {
  const body: ApiError = { success: false, error: { code, message, ...(details ? { details } : {}) } };
  res.status(statusCode).json(body);
}
