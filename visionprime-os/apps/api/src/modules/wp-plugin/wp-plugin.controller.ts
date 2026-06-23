import { Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { sendError, sendSuccess } from "../../common/response";
import { createReservationRateLimiter } from "../../common/rate-limit";
import { validate } from "@visionprime/validation";
import { CustomersRepository } from "../customers/customers.repository";
import { WordPressConnectionRepository } from "../wordpress/wordpress.repository";
import { CheckoutService } from "../checkout/checkout.service";
import { RewardsService } from "../rewards/rewards.service";
import { createPluginAuthMiddleware, PluginAuthedRequest } from "./wp-plugin.middleware";
import { WpPluginService } from "./wp-plugin.service";
import {
  cartKeySchema,
  rewardCartKeySchema,
  rewardConfirmSchema,
  walletAmountSchema,
  walletConfirmSchema,
} from "./wp-plugin.dto";

export interface WpPluginControllerDeps {
  wpPluginService: WpPluginService;
  checkoutService: CheckoutService;
  rewardsService: RewardsService;
  connectionRepository: WordPressConnectionRepository;
  customersRepository: CustomersRepository;
  encryptionKey: string;
}

/**
 * Read-only customer-facing API consumed by the WordPress plugin's
 * AJAX handlers (never called directly from a browser — the plugin's
 * PHP layer is the only client, holding the plugin API key/shared
 * secret server-side). See wp-plugin.middleware.ts for the auth chain.
 */
export function createWpPluginRouter(deps: WpPluginControllerDeps): Router {
  const router = Router();
  const requirePluginAuth = createPluginAuthMiddleware({
    connectionRepository: deps.connectionRepository,
    customersRepository: deps.customersRepository,
    encryptionKey: deps.encryptionKey,
  });

  router.use(requirePluginAuth);

  // Applied to reservation create endpoints only (see common/rate-limit.ts)
  // — cart validate/release/confirm are not rate-limited here since they
  // are not the create operation and are needed at normal checkout pace.
  const reservationRateLimiter = createReservationRateLimiter();

  router.get(
    "/customer/me",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getMe(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/dashboard",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getDashboard(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/wallet",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getWallet(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/points",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getPoints(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/rewards",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getRewards(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/tier",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getTier(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  // ---------------------------------------------------------------- //
  // Checkout wallet reservation — see checkout.service.ts. The amount
  // submitted here is never trusted as the final word; validateWallet/
  // reserveWallet always recompute available balance server-side from
  // the ledger + other active reservations.
  // ---------------------------------------------------------------- //

  router.post(
    "/checkout/wallet/validate",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = validate(walletAmountSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const outcome = await deps.checkoutService.validateWallet(req.vpCustomerId!, result.data!.cartKey, result.data!.amount);
      sendSuccess(res, outcome);
    }),
  );

  router.post(
    "/checkout/wallet/reserve",
    reservationRateLimiter,
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = validate(walletAmountSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const reservation = await deps.checkoutService.reserveWallet(req.vpCustomerId!, result.data!.cartKey, result.data!.amount);
      sendSuccess(res, reservation, {}, 201);
    }),
  );

  router.post(
    "/checkout/wallet/release",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = validate(cartKeySchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const outcome = await deps.checkoutService.releaseWallet(result.data!.cartKey);
      sendSuccess(res, outcome);
    }),
  );

  router.post(
    "/checkout/wallet/confirm",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = validate(walletConfirmSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const reservation = await deps.checkoutService.confirmWallet(result.data!.cartKey, result.data!.woocommerceOrderId);
      sendSuccess(res, reservation);
    }),
  );

  // ---------------------------------------------------------------- //
  // Checkout reward reservation — base structure only. Every validate/
  // reserve/confirm call returns "not available yet" until a real
  // reward catalog/redemption module ships (see checkout.service.ts).
  // ---------------------------------------------------------------- //

  router.post(
    "/checkout/reward/validate",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = validate(rewardCartKeySchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const outcome = await deps.rewardsService.validateReward(req.vpCustomerId!, result.data!.cartKey, result.data!.rewardId);
      sendSuccess(res, outcome);
    }),
  );

  router.post(
    "/checkout/reward/reserve",
    reservationRateLimiter,
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = validate(rewardCartKeySchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const reservation = await deps.rewardsService.reserveReward(req.vpCustomerId!, result.data!.cartKey, result.data!.rewardId);
      sendSuccess(res, reservation, {}, 201);
    }),
  );

  router.post(
    "/checkout/reward/release",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = validate(cartKeySchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const outcome = await deps.rewardsService.releaseReward(result.data!.cartKey);
      sendSuccess(res, outcome);
    }),
  );

  router.post(
    "/checkout/reward/confirm",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = validate(rewardConfirmSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const reservation = await deps.rewardsService.confirmReward(result.data!.cartKey, result.data!.woocommerceOrderId);
      sendSuccess(res, reservation);
    }),
  );

  // ---------------------------------------------------------------- //
  // Reward claim/redeem — see rewards.service.ts. Claiming debits the
  // customer's points ledger; redeeming transitions a claim's status
  // atomically and never re-touches the financial ledger.
  // ---------------------------------------------------------------- //

  router.post(
    "/rewards/:id/claim",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const claim = await deps.rewardsService.claimReward(req.params.id, req.vpCustomerId!);
      sendSuccess(res, claim, {}, 201);
    }),
  );

  router.post(
    "/rewards/:id/redeem",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const claim = await deps.rewardsService.redeemReward(req.params.id, req.vpCustomerId!);
      sendSuccess(res, claim);
    }),
  );

  return router;
}
