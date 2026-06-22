import { Request, Router } from "express";
import { validate } from "@visionprime/validation";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import { RewardsService } from "./rewards.service";
import { newRewardSchema, updateRewardSchema } from "./rewards.dto";

export interface RewardsControllerDeps {
  rewardsService: RewardsService;
  accessSecret: string;
}

function requireAuthContext(req: Request) {
  if (!req.context.auth) {
    throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  }
  return req.context.auth;
}

export function createRewardsRouter(deps: RewardsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("reward:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.rewardsService.listRewards(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/",
    requireAuth,
    requirePermission("reward:create"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newRewardSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const reward = await deps.rewardsService.createReward(result.data!, { userId: auth.userId });
      sendSuccess(res, reward, {}, 201);
    }),
  );

  router.get(
    "/:id",
    requireAuth,
    requirePermission("reward:view"),
    asyncHandler(async (req, res) => {
      const reward = await deps.rewardsService.getReward(req.params.id);
      sendSuccess(res, reward);
    }),
  );

  router.patch(
    "/:id",
    requireAuth,
    requirePermission("reward:update"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateRewardSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const reward = await deps.rewardsService.updateReward(req.params.id, result.data!, { userId: auth.userId });
      sendSuccess(res, reward);
    }),
  );

  router.delete(
    "/:id",
    requireAuth,
    requirePermission("reward:delete"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.rewardsService.deleteReward(req.params.id, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  return router;
}

export function createRewardClaimsRouter(deps: RewardsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("reward_claim:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
      const { rows, meta } = await deps.rewardsService.listClaims(page, pageSize, customerId);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  return router;
}

export function createRewardRedemptionsRouter(deps: RewardsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("reward_redemption:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
      const { rows, meta } = await deps.rewardsService.listRedemptions(page, pageSize, customerId);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  return router;
}
