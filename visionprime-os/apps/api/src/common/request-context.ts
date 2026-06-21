import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

/**
 * Request context placeholder. Phase 01 only attaches a request id for
 * correlation in logs. Auth/user/permission context is attached here
 * once real auth exists, starting Phase 02 — call sites in later
 * phases should read from `req.context` rather than re-deriving it.
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.context = {
    requestId: (req.headers["x-request-id"] as string) || randomUUID(),
  };
  next();
}
