import { Request, Router } from "express";
import { validate } from "@visionprime/validation";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { normalizePageParams } from "../audit/audit.service";
import { NotificationsService } from "./notifications.service";
import {
  newMessageTemplateSchema,
  newNotificationProviderSchema,
  newOptOutSchema,
  newSuppressionListSchema,
  suppressionListMemberSchema,
  updateMessageTemplateSchema,
  updateNotificationProviderSchema,
  updateSuppressionListSchema,
} from "./notifications.dto";

export interface NotificationsControllerDeps {
  notificationsService: NotificationsService;
  accessSecret: string;
}

function requireAuthContext(req: Request) {
  if (!req.context.auth) {
    throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  }
  return req.context.auth;
}

export function createMessageTemplatesRouter(deps: NotificationsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("message_template:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.notificationsService.listTemplates(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/",
    requireAuth,
    requirePermission("message_template:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newMessageTemplateSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const template = await deps.notificationsService.createTemplate(result.data!, { userId: auth.userId });
      sendSuccess(res, template, {}, 201);
    }),
  );

  router.patch(
    "/:id",
    requireAuth,
    requirePermission("message_template:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateMessageTemplateSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const template = await deps.notificationsService.updateTemplate(req.params.id, result.data!, { userId: auth.userId });
      sendSuccess(res, template);
    }),
  );

  router.delete(
    "/:id",
    requireAuth,
    requirePermission("message_template:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.notificationsService.deleteTemplate(req.params.id, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  return router;
}

export function createNotificationProvidersRouter(deps: NotificationsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("notification_provider:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.notificationsService.listProviders(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/",
    requireAuth,
    requirePermission("notification_provider:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newNotificationProviderSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const provider = await deps.notificationsService.createProvider(result.data!, { userId: auth.userId });
      sendSuccess(res, provider, {}, 201);
    }),
  );

  router.patch(
    "/:id",
    requireAuth,
    requirePermission("notification_provider:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateNotificationProviderSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const provider = await deps.notificationsService.updateProvider(req.params.id, result.data!, { userId: auth.userId });
      sendSuccess(res, provider);
    }),
  );

  return router;
}

export function createOptOutsRouter(deps: NotificationsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("notification_provider:view"),
    asyncHandler(async (req, res) => {
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
      const rows = await deps.notificationsService.listOptOuts(customerId);
      sendSuccess(res, rows);
    }),
  );

  router.post(
    "/",
    requireAuth,
    requirePermission("notification_provider:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newOptOutSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const optOut = await deps.notificationsService.createOptOut(result.data!, { userId: auth.userId });
      sendSuccess(res, optOut, {}, 201);
    }),
  );

  router.delete(
    "/:customerId/:channel",
    requireAuth,
    requirePermission("notification_provider:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.notificationsService.removeOptOut(req.params.customerId, req.params.channel, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  return router;
}

export function createSuppressionListsRouter(deps: NotificationsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("notification_provider:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.notificationsService.listSuppressionLists(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.post(
    "/",
    requireAuth,
    requirePermission("notification_provider:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(newSuppressionListSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const list = await deps.notificationsService.createSuppressionList(result.data!, { userId: auth.userId });
      sendSuccess(res, list, {}, 201);
    }),
  );

  router.get(
    "/:id",
    requireAuth,
    requirePermission("notification_provider:view"),
    asyncHandler(async (req, res) => {
      const list = await deps.notificationsService.getSuppressionList(req.params.id);
      sendSuccess(res, list);
    }),
  );

  router.patch(
    "/:id",
    requireAuth,
    requirePermission("notification_provider:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(updateSuppressionListSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const list = await deps.notificationsService.updateSuppressionList(req.params.id, result.data!, { userId: auth.userId });
      sendSuccess(res, list);
    }),
  );

  router.delete(
    "/:id",
    requireAuth,
    requirePermission("notification_provider:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.notificationsService.deleteSuppressionList(req.params.id, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  router.get(
    "/:id/members",
    requireAuth,
    requirePermission("notification_provider:view"),
    asyncHandler(async (req, res) => {
      const members = await deps.notificationsService.listSuppressionListMembers(req.params.id);
      sendSuccess(res, members);
    }),
  );

  router.post(
    "/:id/members",
    requireAuth,
    requirePermission("notification_provider:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      const result = validate(suppressionListMemberSchema, req.body);
      if (!result.success) {
        sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
        return;
      }
      const member = await deps.notificationsService.addSuppressionListMember(req.params.id, result.data!.customerId, { userId: auth.userId });
      sendSuccess(res, member, {}, 201);
    }),
  );

  router.delete(
    "/:id/members/:customerId",
    requireAuth,
    requirePermission("notification_provider:manage"),
    asyncHandler(async (req, res) => {
      const auth = requireAuthContext(req);
      await deps.notificationsService.removeSuppressionListMember(req.params.id, req.params.customerId, { userId: auth.userId });
      sendSuccess(res, { deleted: true });
    }),
  );

  return router;
}
