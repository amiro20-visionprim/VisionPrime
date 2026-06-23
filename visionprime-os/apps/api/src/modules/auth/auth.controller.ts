import { Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { validate } from "@visionprime/validation";
import { sendSuccess, sendError } from "../../common/response";
import { createRequireAuth } from "../../common/auth/auth-middleware";
import { HttpError } from "../../common/http-error";
import { createLoginRateLimiter } from "../../common/rate-limit";
import { loginSchema, logoutSchema, refreshSchema } from "./auth.dto";
import { AuthService } from "./auth.service";

export interface AuthControllerDeps {
  authService: AuthService;
  accessSecret: string;
}

export function createAuthRouter(deps: AuthControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  // Tight rate limit (see common/rate-limit.ts) — login is the most
  // brute-force-prone unauthenticated surface in the API.
  router.post("/login", createLoginRateLimiter(), asyncHandler(async (req, res) => {
    const result = validate(loginSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }

    const meta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] as string | undefined };
    const loginResult = await deps.authService.login(result.data!.email, result.data!.password, meta);
    sendSuccess(res, loginResult);
  }));

  router.post("/refresh", asyncHandler(async (req, res) => {
    const result = validate(refreshSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }

    const meta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] as string | undefined };
    const refreshResult = await deps.authService.refresh(result.data!.refreshToken, meta);
    sendSuccess(res, refreshResult);
  }));

  router.post("/logout", asyncHandler(async (req, res) => {
    const result = validate(logoutSchema, req.body);
    if (!result.success) {
      sendError(res, "VALIDATION_FAILED", "One or more fields are invalid.", 400, result.fieldErrors);
      return;
    }

    const meta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] as string | undefined };
    await deps.authService.logout(result.data!.refreshToken, req.context.auth?.userId, meta);
    sendSuccess(res, { success: true });
  }));

  router.get("/me", requireAuth, asyncHandler(async (req, res) => {
    if (!req.context.auth) {
      throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
    }
    const me = await deps.authService.getMe(req.context.auth.userId);
    sendSuccess(res, me);
  }));

  return router;
}
