import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not forward promise rejections/thrown errors from async
 * handlers to the error-handling middleware automatically. Every async
 * route handler and middleware in this app must be wrapped with this so
 * `HttpError`s thrown inside `async` functions reach `createErrorFilter`.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void,
): RequestHandler {
  return function wrapped(req: Request, res: Response, next: NextFunction): void {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
