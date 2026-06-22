import { Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { normalizePageParams } from "../audit/audit.service";
import { CheckoutService } from "./checkout.service";

export interface CheckoutControllerDeps {
  checkoutService: CheckoutService;
  accessSecret: string;
}

/**
 * Admin-facing reservation visibility only (list/detail) — the actual
 * reservation lifecycle (validate/reserve/release/confirm) is only ever
 * driven by the WordPress plugin via /api/wp-plugin/checkout/* (see
 * wp-plugin.controller.ts), never by an admin-authenticated call.
 */
export function createWalletReservationsRouter(deps: CheckoutControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("wallet_reservation:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.checkoutService.listWalletReservations(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  // Registered before "/:id" so it can never be shadowed by an id match.
  router.get(
    "/customer/:customerId",
    requireAuth,
    requirePermission("wallet_reservation:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.checkoutService.listWalletReservationsByCustomer(
        req.params.customerId,
        page,
        pageSize,
      );
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.get(
    "/:id",
    requireAuth,
    requirePermission("wallet_reservation:view"),
    asyncHandler(async (req, res) => {
      const reservation = await deps.checkoutService.getWalletReservation(req.params.id);
      sendSuccess(res, reservation);
    }),
  );

  return router;
}

export function createRewardReservationsRouter(deps: CheckoutControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("reward_reservation:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.checkoutService.listRewardReservations(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  return router;
}
