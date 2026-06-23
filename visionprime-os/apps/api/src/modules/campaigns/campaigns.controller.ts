import { Request, Router } from "express";
import { validate } from "@visionprime/validation";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { createCampaignSendRateLimiter } from "../../common/rate-limit";
import { normalizePageParams } from "../audit/audit.service";
import { CampaignsService } from "./campaigns.service";
import { campaignPreviewSchema, newCampaignSchema, updateCampaignSchema } from "./campaigns.dto";

export interface CampaignsControllerDeps {
  campaignsService: CampaignsService;
  accessSecret: string;
}

function requireAuthContext(req: Request) {
  if (!req.context.auth) {
    throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  }
  return req.context.auth;
}

export function createCampaignsRouter(deps: CampaignsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("campaign:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.campaignsService.listCampaigns(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/",
    requireAuth,
    requirePermission("campaign:create"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newCampaignSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const campaign = await deps.campaignsService.createCampaign(result.data!, { userId: auth.userId });
      sendSuccess(res, campaign, {}, 201);
    }),
  );

  router.get(
    "/:id",
    requireAuth,
    requirePermission("campaign:view"),
    asyncHandler(async (req, res) => {
      const campaign = await deps.campaignsService.getCampaign(req.params.id);
      sendSuccess(res, campaign);
    }),
  );

  router.patch(
    "/:id",
    requireAuth,
    requirePermission("campaign:update"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateCampaignSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const campaign = await deps.campaignsService.updateCampaign(req.params.id, result.data!, { userId: auth.userId });
      sendSuccess(res, campaign);
    }),
  );

  router.delete(
    "/:id",
    requireAuth,
    requirePermission("campaign:delete"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.campaignsService.deleteCampaign(req.params.id, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  router.post(
    "/:id/approve",
    requireAuth,
    requirePermission("campaign:update"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const campaign = await deps.campaignsService.approveCampaign(req.params.id, { userId: auth.userId });
      sendSuccess(res, campaign);
    }),
  );

  router.post(
    "/:id/preview",
    requireAuth,
    requirePermission("campaign:view"),
    asyncHandler(async (req, res) => {
      const result = validate(campaignPreviewSchema, req.body ?? {});
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const preview = await deps.campaignsService.previewCampaign(req.params.id, result.data!.context ?? {});
      sendSuccess(res, preview);
    }),
  );

  router.post(
    "/:id/send",
    requireAuth,
    requirePermission("campaign:send"),
    createCampaignSendRateLimiter(),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const campaign = await deps.campaignsService.sendCampaign(req.params.id, { userId: auth.userId });
      sendSuccess(res, campaign);
    }),
  );

  router.get(
    "/:id/recipients",
    requireAuth,
    requirePermission("campaign:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.campaignsService.listRecipients(req.params.id, page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.get(
    "/:id/report",
    requireAuth,
    requirePermission("campaign:report:view"),
    asyncHandler(async (req, res) => {
      const report = await deps.campaignsService.getReport(req.params.id);
      sendSuccess(res, report);
    }),
  );

  return router;
}
