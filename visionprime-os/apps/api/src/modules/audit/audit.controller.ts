import { Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { AuditService, normalizePageParams } from "./audit.service";

export interface AuditControllerDeps {
  auditService: AuditService;
  accessSecret: string;
}

export function createAuditRouter(deps: AuditControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get("/audit-logs", requireAuth, requirePermission("audit:view"), asyncHandler(async (req, res) => {
    const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
    const { rows, meta } = await deps.auditService.listAuditLogs(page, pageSize);
    sendSuccess(res, rows, { ...meta });
  }));

  router.get("/activity-logs", requireAuth, requirePermission("audit:view"), asyncHandler(async (req, res) => {
    const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
    const { rows, meta } = await deps.auditService.listActivityLogs(page, pageSize);
    sendSuccess(res, rows, { ...meta });
  }));

  router.get("/security-events", requireAuth, requirePermission("security_event:view"), asyncHandler(async (req, res) => {
    const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
    const { rows, meta } = await deps.auditService.listSecurityEvents(page, pageSize);
    sendSuccess(res, rows, { ...meta });
  }));

  return router;
}
