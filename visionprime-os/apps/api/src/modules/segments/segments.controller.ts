import { Request, Router } from "express";
import { validate } from "@visionprime/validation";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import { SegmentsService } from "./segments.service";
import { newSegmentSchema, updateSegmentSchema } from "./segments.dto";
import { NewSegmentRecord, UpdateSegmentRecord } from "./segments.types";

export interface SegmentsControllerDeps {
  segmentsService: SegmentsService;
  accessSecret: string;
}

function requireAuthContext(req: Request) {
  if (!req.context.auth) {
    throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  }
  return req.context.auth;
}

export function createSegmentsRouter(deps: SegmentsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("segment:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.segmentsService.listSegments(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/",
    requireAuth,
    requirePermission("segment:create"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newSegmentSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const segment = await deps.segmentsService.createSegment(result.data! as NewSegmentRecord, { userId: auth.userId });
      sendSuccess(res, segment, {}, 201);
    }),
  );

  router.get(
    "/:id",
    requireAuth,
    requirePermission("segment:view"),
    asyncHandler(async (req, res) => {
      const segment = await deps.segmentsService.getSegment(req.params.id);
      sendSuccess(res, segment);
    }),
  );

  router.patch(
    "/:id",
    requireAuth,
    requirePermission("segment:update"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateSegmentSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const segment = await deps.segmentsService.updateSegment(req.params.id, result.data! as UpdateSegmentRecord, { userId: auth.userId });
      sendSuccess(res, segment);
    }),
  );

  router.delete(
    "/:id",
    requireAuth,
    requirePermission("segment:delete"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.segmentsService.deleteSegment(req.params.id, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  router.post(
    "/:id/evaluate",
    requireAuth,
    requirePermission("segment:evaluate"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const segment = await deps.segmentsService.evaluateSegment(req.params.id, { userId: auth.userId });
      sendSuccess(res, segment);
    }),
  );

  router.get(
    "/:id/members",
    requireAuth,
    requirePermission("segment:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.segmentsService.listMembers(req.params.id, page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  return router;
}
