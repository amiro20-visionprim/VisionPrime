import { Request, Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { validate } from "@visionprime/validation";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import { createUserSchema, updateUserSchema } from "./users.dto";
import { UsersService } from "./users.service";

export interface UsersControllerDeps {
  usersService: UsersService;
  accessSecret: string;
}

export function createUsersRouter(deps: UsersControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  function requireAuthContext(req: Request) {
    if (!req.context.auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }
    return req.context.auth;
  }

  router.get("/", requireAuth, requirePermission("user:view"), asyncHandler(async (req, res) => {
    const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
    const { rows, meta } = await deps.usersService.list(page, pageSize);
    sendSuccess(res, rows, { ...meta });
  }));

  router.post("/", requireAuth, requirePermission("user:create"), asyncHandler(async (req, res) => {
    const result = validate(createUserSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }
    const auth = requireAuthContext(req);
    const created = await deps.usersService.create(result.data!, { userId: auth.userId, isSuperAdmin: auth.isSuperAdmin });
    sendSuccess(res, created, {}, 201);
  }));

  router.get("/:id", requireAuth, requirePermission("user:view"), asyncHandler(async (req, res) => {
    const user = await deps.usersService.getById(req.params.id);
    sendSuccess(res, user);
  }));

  router.patch("/:id", requireAuth, requirePermission("user:update"), asyncHandler(async (req, res) => {
    const result = validate(updateUserSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }
    const auth = requireAuthContext(req);
    const updated = await deps.usersService.update(req.params.id, result.data!, {
      userId: auth.userId,
      isSuperAdmin: auth.isSuperAdmin,
    });
    sendSuccess(res, updated);
  }));

  router.delete("/:id", requireAuth, requirePermission("user:delete"), asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    await deps.usersService.delete(req.params.id, { userId: auth.userId, isSuperAdmin: auth.isSuperAdmin });
    sendSuccess(res, { success: true });
  }));

  return router;
}
