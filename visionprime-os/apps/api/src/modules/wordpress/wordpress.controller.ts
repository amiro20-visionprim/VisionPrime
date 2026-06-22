import { Request, Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { validate } from "@visionprime/validation";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { connectSchema, updateSettingsSchema } from "./wordpress.dto";
import { WordPressService } from "./wordpress.service";
import { WordPressSyncService } from "./wordpress-sync.service";

export interface WordPressControllerDeps {
  wordpressService: WordPressService;
  syncService: WordPressSyncService;
  accessSecret: string;
}

export function createWordPressRouter(deps: WordPressControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  function requireAuthContext(req: Request) {
    if (!req.context.auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }
    return req.context.auth;
  }

  router.get("/status", requireAuth, requirePermission("wordpress:view"), asyncHandler(async (_req, res) => {
    const status = await deps.wordpressService.getStatus();
    sendSuccess(res, status);
  }));

  router.post("/connect", requireAuth, requirePermission("wordpress:connect"), asyncHandler(async (req, res) => {
    const result = validate(connectSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }
    const auth = requireAuthContext(req);
    const connection = await deps.wordpressService.connect(result.data!, auth.userId);
    sendSuccess(res, connection, {}, 201);
  }));

  router.patch("/settings", requireAuth, requirePermission("wordpress:update"), asyncHandler(async (req, res) => {
    const result = validate(updateSettingsSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }
    const auth = requireAuthContext(req);
    const connection = await deps.wordpressService.updateSettings(result.data!, auth.userId);
    sendSuccess(res, connection);
  }));

  router.post("/test-connection", requireAuth, requirePermission("wordpress:test"), asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const connection = await deps.wordpressService.testConnection(auth.userId);
    sendSuccess(res, connection);
  }));

  router.post("/webhooks/register", requireAuth, requirePermission("wordpress:webhook_register"), asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const connection = await deps.wordpressService.registerWebhook(auth.userId);
    sendSuccess(res, connection);
  }));

  router.get("/sync/jobs", requireAuth, requirePermission("wordpress:sync_job:view"), asyncHandler(async (req, res) => {
    const { rows, meta } = await deps.wordpressService.listSyncJobs(req.query.page, req.query.pageSize);
    sendSuccess(res, rows, { ...meta });
  }));

  router.get("/sync/logs", requireAuth, requirePermission("wordpress:sync_log:view"), asyncHandler(async (req, res) => {
    const { rows, meta } = await deps.wordpressService.listSyncLogs(req.query.page, req.query.pageSize);
    sendSuccess(res, rows, { ...meta });
  }));

  router.post("/sync/customers", requireAuth, requirePermission("wordpress:sync_customer"), asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const result = await deps.syncService.syncCustomers(auth.userId);
    sendSuccess(res, result);
  }));

  router.post("/sync/products", requireAuth, requirePermission("wordpress:sync_product"), asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const result = await deps.syncService.syncProducts(auth.userId);
    sendSuccess(res, result);
  }));

  router.post(
    "/sync/incremental",
    requireAuth,
    requirePermission("wordpress:sync_customer"),
    requirePermission("wordpress:sync_product"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = await deps.syncService.syncIncremental(auth.userId);
      sendSuccess(res, result);
    }),
  );

  return router;
}
