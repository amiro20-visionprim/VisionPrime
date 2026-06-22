import { NextFunction, Request, Response } from "express";
import { hasPermission, Permission, PermissionContext } from "@visionprime/permissions";
import { HttpError } from "../http-error";
import { verifyAccessToken } from "./jwt";

/**
 * Reads `Authorization: Bearer <token>`, verifies the access JWT, and
 * populates `req.context.auth`. Must run before any `requirePermission`
 * guard or business logic that reads `req.context.auth`.
 */
export function createRequireAuth(accessSecret: string) {
  return function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }

    const token = header.slice("Bearer ".length).trim();
    try {
      const payload = verifyAccessToken(token, accessSecret);
      req.context.auth = {
        userId: payload.userId,
        isSuperAdmin: payload.isSuperAdmin,
        permissions: payload.permissions,
      };
      next();
    } catch {
      throw new HttpError(401, "AUTH_INVALID_TOKEN", "The access token is invalid or expired.");
    }
  };
}

/**
 * Permission guard factory. Must run after `requireAuth` so
 * `req.context.auth` is populated.
 */
export function requirePermission(key: Permission) {
  return function permissionGuard(req: Request, _res: Response, next: NextFunction): void {
    const auth = req.context.auth;
    if (!auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }

    const context: PermissionContext = {
      userId: auth.userId,
      isSuperAdmin: auth.isSuperAdmin,
      permissions: auth.permissions as Permission[],
    };

    if (!hasPermission(context, key)) {
      throw new HttpError(403, "PERMISSION_DENIED", `Missing required permission: ${key}`);
    }

    next();
  };
}
