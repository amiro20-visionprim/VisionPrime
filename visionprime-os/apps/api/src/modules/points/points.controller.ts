import { Router } from "express";
import { z } from "@visionprime/validation";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { normalizePageParams } from "../audit/audit.service";
import { PointsService } from "./points.service";

export interface PointsControllerDeps {
  pointsService: PointsService;
  accessSecret: string;
}

const customerIdParamSchema = z.object({ customerId: z.string().uuid() });

export function createPointsRouter(deps: PointsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/customer/:customerId",
    requireAuth,
    requirePermission("points:view"),
    asyncHandler(async (req, res) => {
      const params = customerIdParamSchema.parse({ customerId: req.params.customerId });
      const balance = await deps.pointsService.getBalance(params.customerId);
      sendSuccess(res, balance);
    }),
  );

  router.get(
    "/customer/:customerId/ledger",
    requireAuth,
    requirePermission("points:view"),
    asyncHandler(async (req, res) => {
      const params = customerIdParamSchema.parse({ customerId: req.params.customerId });
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.pointsService.listLedger(params.customerId, page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  return router;
}
