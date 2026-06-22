import { Request, Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import { OrdersService } from "./orders.service";

export interface OrdersControllerDeps {
  ordersService: OrdersService;
  /** Delegates to WordPressSyncService.syncOrders — kept as an injected
   * function so the orders module never imports the wordpress module
   * directly (sync logic/credentials live there). */
  syncOrdersFromWordPress: (actorId: string) => Promise<unknown>;
  accessSecret: string;
}

export function createOrdersRouter(deps: OrdersControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  function requireAuthContext(req: Request) {
    if (!req.context.auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }
    return req.context.auth;
  }

  router.get(
    "/",
    requireAuth,
    requirePermission("order:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
      const { rows, meta } = await deps.ordersService.list(page, pageSize, customerId);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/sync-from-wordpress",
    requireAuth,
    requirePermission("order:sync"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = await deps.syncOrdersFromWordPress(auth.userId);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/:id",
    requireAuth,
    requirePermission("order:view"),
    asyncHandler(async (req, res) => {
      const detail = await deps.ordersService.getDetail(req.params.id);
      sendSuccess(res, detail);
    }),
  );

  return router;
}
