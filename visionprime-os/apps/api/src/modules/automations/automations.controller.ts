import { Request, Router } from "express";
import { validate } from "@visionprime/validation";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import { AutomationsService } from "./automations.service";
import { newAutomationWorkflowSchema, updateAutomationWorkflowSchema } from "./automations.dto";

export interface AutomationsControllerDeps {
  automationsService: AutomationsService;
  accessSecret: string;
}

function requireAuthContext(req: Request) {
  if (!req.context.auth) {
    throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  }
  return req.context.auth;
}

export function createAutomationsRouter(deps: AutomationsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("automation:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.automationsService.listWorkflows(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/",
    requireAuth,
    requirePermission("automation:create"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newAutomationWorkflowSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const workflow = await deps.automationsService.createWorkflow(result.data!, { userId: auth.userId });
      sendSuccess(res, workflow, {}, 201);
    }),
  );

  router.get(
    "/:id",
    requireAuth,
    requirePermission("automation:view"),
    asyncHandler(async (req, res) => {
      const workflow = await deps.automationsService.getWorkflow(req.params.id);
      sendSuccess(res, workflow);
    }),
  );

  router.patch(
    "/:id",
    requireAuth,
    requirePermission("automation:update"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateAutomationWorkflowSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const workflow = await deps.automationsService.updateWorkflow(req.params.id, result.data!, { userId: auth.userId });
      sendSuccess(res, workflow);
    }),
  );

  router.delete(
    "/:id",
    requireAuth,
    requirePermission("automation:delete"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.automationsService.deleteWorkflow(req.params.id, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  router.post(
    "/:id/activate",
    requireAuth,
    requirePermission("automation:activate"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const workflow = await deps.automationsService.setActive(req.params.id, true, { userId: auth.userId });
      sendSuccess(res, workflow);
    }),
  );

  router.post(
    "/:id/deactivate",
    requireAuth,
    requirePermission("automation:activate"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const workflow = await deps.automationsService.setActive(req.params.id, false, { userId: auth.userId });
      sendSuccess(res, workflow);
    }),
  );

  router.get(
    "/:id/runs",
    requireAuth,
    requirePermission("automation:run:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.automationsService.listRuns(req.params.id, page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  return router;
}
