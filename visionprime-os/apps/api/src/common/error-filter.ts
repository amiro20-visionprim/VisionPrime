import { NextFunction, Request, Response } from "express";
import { Logger } from "@visionprime/logger";
import { HttpError } from "./http-error";
import { sendError } from "./response";

/**
 * Global error filter. This is the only place that turns a thrown error
 * into an HTTP response. It never leaks raw database/internal errors —
 * see /docs/api-conventions.md and /docs/definition-of-done.md.
 */
export function createErrorFilter(logger: Logger) {
  return function errorFilter(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof HttpError) {
      logger.warn("Handled request error", {
        requestId: req.context?.requestId,
        code: err.code,
        statusCode: err.statusCode,
      });
      sendError(res, err.code, err.message, err.statusCode, err.details);
      return;
    }

    logger.error("Unhandled request error", {
      requestId: req.context?.requestId,
      error: err instanceof Error ? err.message : String(err),
    });

    sendError(res, "INTERNAL_ERROR", "An unexpected error occurred.", 500);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, "NOT_FOUND", `Route ${req.method} ${req.path} not found`, 404);
}
