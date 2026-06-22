import { Request, Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { validate } from "@visionprime/validation";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import {
  addNoteSchema,
  addTagSchema,
  createCustomerSchema,
  mergeCustomersSchema,
  updateCustomerSchema,
} from "./customers.dto";
import { CustomersService } from "./customers.service";

export interface CustomersControllerDeps {
  customersService: CustomersService;
  accessSecret: string;
}

export function createCustomersRouter(deps: CustomersControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  function requireAuthContext(req: Request) {
    if (!req.context.auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }
    return req.context.auth;
  }

  function actorFrom(req: Request) {
    const auth = requireAuthContext(req);
    return { userId: auth.userId, isSuperAdmin: auth.isSuperAdmin };
  }

  router.get(
    "/",
    requireAuth,
    requirePermission("customer:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.customersService.list(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/",
    requireAuth,
    requirePermission("customer:create"),
    asyncHandler(async (req, res) => {
      const result = validate(createCustomerSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const created = await deps.customersService.create(result.data!, actorFrom(req));
      sendSuccess(res, created, {}, 201);
    }),
  );

  router.post(
    "/merge",
    requireAuth,
    requirePermission("customer:merge"),
    asyncHandler(async (req, res) => {
      const result = validate(mergeCustomersSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const survivor = await deps.customersService.merge(
        result.data!.survivorCustomerId,
        result.data!.mergedCustomerId,
        actorFrom(req),
      );
      sendSuccess(res, survivor);
    }),
  );

  router.get(
    "/:id",
    requireAuth,
    requirePermission("customer:view"),
    asyncHandler(async (req, res) => {
      const customer = await deps.customersService.getById(req.params.id);
      sendSuccess(res, customer);
    }),
  );

  router.get(
    "/:id/360",
    requireAuth,
    requirePermission("customer:view"),
    asyncHandler(async (req, res) => {
      const result = await deps.customersService.get360(req.params.id);
      sendSuccess(res, result);
    }),
  );

  router.patch(
    "/:id",
    requireAuth,
    requirePermission("customer:update"),
    asyncHandler(async (req, res) => {
      const result = validate(updateCustomerSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const updated = await deps.customersService.update(req.params.id, result.data!, actorFrom(req));
      sendSuccess(res, updated);
    }),
  );

  router.delete(
    "/:id",
    requireAuth,
    requirePermission("customer:delete"),
    asyncHandler(async (req, res) => {
      await deps.customersService.softDelete(req.params.id, actorFrom(req));
      sendSuccess(res, { success: true });
    }),
  );

  router.post(
    "/:id/notes",
    requireAuth,
    requirePermission("customer:note:create"),
    asyncHandler(async (req, res) => {
      const result = validate(addNoteSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const note = await deps.customersService.addNote(req.params.id, result.data!.note, actorFrom(req));
      sendSuccess(res, note, {}, 201);
    }),
  );

  router.post(
    "/:id/tags",
    requireAuth,
    requirePermission("customer:tag:update"),
    asyncHandler(async (req, res) => {
      const result = validate(addTagSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const tag = await deps.customersService.addTag(req.params.id, result.data!.tag, actorFrom(req));
      sendSuccess(res, tag, {}, 201);
    }),
  );

  return router;
}
