import { Request, Router } from "express";
import { validate, z } from "@visionprime/validation";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import { manualCreditSchema, manualDebitSchema, reverseEntrySchema } from "./wallet.dto";
import { WalletService } from "./wallet.service";

export interface WalletControllerDeps {
  walletService: WalletService;
  accessSecret: string;
}

const customerIdParamSchema = z.object({ customerId: z.string().uuid() });

export function createWalletRouter(deps: WalletControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  function requireAuthContext(req: Request) {
    if (!req.context.auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }
    return req.context.auth;
  }

  // Registered before the generic "/:customerId" route so it can never be
  // shadowed by a customerId match.
  router.get(
    "/reports/liability",
    requireAuth,
    requirePermission("wallet:report:view"),
    asyncHandler(async (_req, res) => {
      const report = await deps.walletService.getLiabilityReport();
      sendSuccess(res, report);
    }),
  );

  router.post(
    "/ledger/:entryId/reverse",
    requireAuth,
    requirePermission("wallet:reverse"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(reverseEntrySchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const outcome = await deps.walletService.reverseEntry(req.params.entryId, result.data!.reason, {
        userId: auth.userId,
      });
      sendSuccess(res, outcome);
    }),
  );

  router.get(
    "/:customerId",
    requireAuth,
    requirePermission("wallet:view"),
    asyncHandler(async (req, res) => {
      const params = customerIdParamSchema.parse({ customerId: req.params.customerId });
      const wallet = await deps.walletService.getWalletSummary(params.customerId);
      sendSuccess(res, wallet);
    }),
  );

  router.get(
    "/:customerId/ledger",
    requireAuth,
    requirePermission("wallet:view"),
    asyncHandler(async (req, res) => {
      const params = customerIdParamSchema.parse({ customerId: req.params.customerId });
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.walletService.listLedger(params.customerId, page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/:customerId/manual-credit",
    requireAuth,
    requirePermission("wallet:manual_credit"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const params = customerIdParamSchema.parse({ customerId: req.params.customerId });
      const result = validate(manualCreditSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const outcome = await deps.walletService.manualCredit(params.customerId, result.data!, {
        userId: auth.userId,
      });
      sendSuccess(res, outcome, {}, 201);
    }),
  );

  router.post(
    "/:customerId/manual-debit",
    requireAuth,
    requirePermission("wallet:manual_debit"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const params = customerIdParamSchema.parse({ customerId: req.params.customerId });
      const result = validate(manualDebitSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const outcome = await deps.walletService.manualDebit(params.customerId, result.data!, {
        userId: auth.userId,
      });
      sendSuccess(res, outcome, {}, 201);
    }),
  );

  return router;
}
