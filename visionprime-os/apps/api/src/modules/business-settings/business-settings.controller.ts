import { Request, Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { validate } from "@visionprime/validation";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { updateAppearanceSchema, updateFeaturesSchema, updateGeneralSchema } from "./business-settings.dto";
import { BusinessSettingsService } from "./business-settings.service";

export interface BusinessSettingsControllerDeps {
  businessSettingsService: BusinessSettingsService;
  accessSecret: string;
}

export function createBusinessSettingsRouter(deps: BusinessSettingsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  function requireAuthContext(req: Request) {
    if (!req.context.auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }
    return req.context.auth;
  }

  router.get("/business", requireAuth, requirePermission("settings:view"), asyncHandler(async (_req, res) => {
    const settings = await deps.businessSettingsService.get();
    sendSuccess(res, settings);
  }));

  router.patch("/business", requireAuth, requirePermission("settings:manage"), asyncHandler(async (req, res) => {
    const result = validate(updateGeneralSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }
    const auth = requireAuthContext(req);
    const updated = await deps.businessSettingsService.updateGeneral(result.data!, auth.userId);
    sendSuccess(res, updated);
  }));

  router.patch("/features", requireAuth, requirePermission("settings:manage"), asyncHandler(async (req, res) => {
    const result = validate(updateFeaturesSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }
    const auth = requireAuthContext(req);
    const updated = await deps.businessSettingsService.updateFeatures(result.data!, auth.userId);
    sendSuccess(res, updated);
  }));

  router.patch("/appearance", requireAuth, requirePermission("settings:manage"), asyncHandler(async (req, res) => {
    const result = validate(updateAppearanceSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }
    const auth = requireAuthContext(req);
    const updated = await deps.businessSettingsService.updateAppearance(result.data!, auth.userId);
    sendSuccess(res, updated);
  }));

  return router;
}
