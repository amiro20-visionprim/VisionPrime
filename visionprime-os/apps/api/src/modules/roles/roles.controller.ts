import { Request, Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { validate } from "@visionprime/validation";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import { createRoleSchema, updateRoleSchema } from "./roles.dto";
import { RolesService } from "./roles.service";

export interface RolesControllerDeps {
  rolesService: RolesService;
  accessSecret: string;
}

export function createRolesRouter(deps: RolesControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  function requireAuthContext(req: Request) {
    if (!req.context.auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }
    return req.context.auth;
  }

  router.get("/", requireAuth, requirePermission("role:view"), asyncHandler(async (req, res) => {
    const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
    const { rows, meta } = await deps.rolesService.list(page, pageSize);
    sendSuccess(res, rows, { ...meta });
  }));

  router.post("/", requireAuth, requirePermission("role:create"), asyncHandler(async (req, res) => {
    const result = validate(createRoleSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }
    const auth = requireAuthContext(req);
    const created = await deps.rolesService.create(result.data!, {
      userId: auth.userId,
      isSuperAdmin: auth.isSuperAdmin,
    });
    sendSuccess(res, created, {}, 201);
  }));

  router.get("/:id", requireAuth, requirePermission("role:view"), asyncHandler(async (req, res) => {
    const role = await deps.rolesService.getById(req.params.id);
    sendSuccess(res, role);
  }));

  router.patch("/:id", requireAuth, requirePermission("role:update"), asyncHandler(async (req, res) => {
    const result = validate(updateRoleSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }
    const auth = requireAuthContext(req);
    const updated = await deps.rolesService.update(req.params.id, result.data!, {
      userId: auth.userId,
      isSuperAdmin: auth.isSuperAdmin,
    });
    sendSuccess(res, updated);
  }));

  router.delete("/:id", requireAuth, requirePermission("role:delete"), asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    await deps.rolesService.delete(req.params.id, { userId: auth.userId, isSuperAdmin: auth.isSuperAdmin });
    sendSuccess(res, { success: true });
  }));

  return router;
}
