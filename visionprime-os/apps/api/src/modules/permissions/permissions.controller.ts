import { Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { PermissionsService } from "./permissions.service";

export interface PermissionsControllerDeps {
  permissionsService: PermissionsService;
  accessSecret: string;
}

export function createPermissionsRouter(deps: PermissionsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get("/", requireAuth, requirePermission("permission:view"), asyncHandler(async (_req, res) => {
    const catalog = await deps.permissionsService.listCatalog();
    sendSuccess(res, catalog);
  }));

  return router;
}
