import { Request, Router } from "express";
import { validate, z } from "@visionprime/validation";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import { LoyaltyService } from "./loyalty.service";
import {
  newLoyaltyProgramSchema,
  newLoyaltyRuleSchema,
  newLoyaltyTierSchema,
  updateLoyaltyProgramSchema,
  updateLoyaltyRuleSchema,
  updateLoyaltyTierSchema,
} from "./loyalty.dto";

export interface LoyaltyControllerDeps {
  loyaltyService: LoyaltyService;
  accessSecret: string;
}

function requireAuthContext(req: Request) {
  if (!req.context.auth) {
    throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  }
  return req.context.auth;
}

const customerIdParamSchema = z.object({ customerId: z.string().uuid() });

export function createLoyaltyRouter(deps: LoyaltyControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/customer/:customerId/status",
    requireAuth,
    requirePermission("loyalty:view"),
    asyncHandler(async (req, res) => {
      const params = customerIdParamSchema.parse({ customerId: req.params.customerId });
      const status = await deps.loyaltyService.getCustomerStatus(params.customerId);
      sendSuccess(res, status);
    }),
  );

  router.get(
    "/programs",
    requireAuth,
    requirePermission("loyalty:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.loyaltyService.listPrograms(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/programs",
    requireAuth,
    requirePermission("loyalty:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newLoyaltyProgramSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const program = await deps.loyaltyService.createProgram(result.data!, { userId: auth.userId });
      sendSuccess(res, program, {}, 201);
    }),
  );

  router.patch(
    "/programs/:id",
    requireAuth,
    requirePermission("loyalty:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateLoyaltyProgramSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const program = await deps.loyaltyService.updateProgram(req.params.id, result.data!, { userId: auth.userId });
      sendSuccess(res, program);
    }),
  );

  router.get(
    "/tiers",
    requireAuth,
    requirePermission("loyalty:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const programId = typeof req.query.programId === "string" ? req.query.programId : undefined;
      const { rows, meta } = await deps.loyaltyService.listTiers(page, pageSize, programId);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/tiers",
    requireAuth,
    requirePermission("loyalty:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newLoyaltyTierSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const tier = await deps.loyaltyService.createTier(result.data!, { userId: auth.userId });
      sendSuccess(res, tier, {}, 201);
    }),
  );

  router.patch(
    "/tiers/:id",
    requireAuth,
    requirePermission("loyalty:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateLoyaltyTierSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const tier = await deps.loyaltyService.updateTier(req.params.id, result.data!, { userId: auth.userId });
      sendSuccess(res, tier);
    }),
  );

  router.delete(
    "/tiers/:id",
    requireAuth,
    requirePermission("loyalty:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.loyaltyService.deleteTier(req.params.id, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  router.get(
    "/rules",
    requireAuth,
    requirePermission("loyalty:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const programId = typeof req.query.programId === "string" ? req.query.programId : undefined;
      const { rows, meta } = await deps.loyaltyService.listRules(page, pageSize, programId);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/rules",
    requireAuth,
    requirePermission("loyalty:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newLoyaltyRuleSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const rule = await deps.loyaltyService.createRule(result.data!, { userId: auth.userId });
      sendSuccess(res, rule, {}, 201);
    }),
  );

  router.patch(
    "/rules/:id",
    requireAuth,
    requirePermission("loyalty:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateLoyaltyRuleSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const rule = await deps.loyaltyService.updateRule(req.params.id, result.data!, { userId: auth.userId });
      sendSuccess(res, rule);
    }),
  );

  router.delete(
    "/rules/:id",
    requireAuth,
    requirePermission("loyalty:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.loyaltyService.deleteRule(req.params.id, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  return router;
}
