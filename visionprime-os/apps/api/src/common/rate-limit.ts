import rateLimit, { Options } from "express-rate-limit";
import { Request, Response } from "express";
import { sendError } from "./response";

/**
 * Reusable rate-limiter factories for Phase 13 production hardening.
 * Limits are intentionally generous for legitimate sync/plugin traffic
 * and tight for brute-force-prone surfaces (login). Numbers documented
 * in /docs/security-review.md — change both places together.
 *
 * All limiters key on IP address (express-rate-limit default, via
 * req.ip) and return the same envelope shape as the rest of the API
 * (see common/response.ts) rather than express-rate-limit's default
 * plaintext body, so clients get a consistent error shape.
 */

function rateLimitedHandler(req: Request, res: Response) {
  sendError(res, "RATE_LIMITED", "Too many requests. Please try again later.", 429);
}

function buildLimiter(options: Partial<Options> & { windowMs: number; max: number }) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitedHandler,
    ...options,
  });
}

/** Login endpoint: 10 attempts/min/IP — tight, brute-force-prone surface. */
export function createLoginRateLimiter() {
  return buildLimiter({ windowMs: 60 * 1000, max: 10 });
}

/** WordPress webhook receiver: 100/min/IP — generous, legitimate WooCommerce delivery bursts. */
export function createWebhookRateLimiter() {
  return buildLimiter({ windowMs: 60 * 1000, max: 100 });
}

/** WP plugin customer-facing API: 60/min/IP — covers dashboard polling from many shoppers behind shared IPs (NAT/proxy), still bounds abuse. */
export function createPluginApiRateLimiter() {
  return buildLimiter({ windowMs: 60 * 1000, max: 60 });
}

/** Checkout wallet/reward reservation create: 30/min/IP — bursty (cart updates) but bounded. */
export function createReservationRateLimiter() {
  return buildLimiter({ windowMs: 60 * 1000, max: 30 });
}

/** Campaign send: 5/min/IP — rare, expensive, admin-only action. */
export function createCampaignSendRateLimiter() {
  return buildLimiter({ windowMs: 60 * 1000, max: 5 });
}

/**
 * Generous global default limiter applied to the whole app as
 * defense-in-depth — high enough that it should never affect legitimate
 * admin/sync/plugin traffic in practice (those have their own tighter,
 * route-specific limiters above), but stops unbounded abuse against any
 * route that wasn't explicitly covered.
 */
export function createGlobalRateLimiter() {
  return buildLimiter({ windowMs: 60 * 1000, max: 600 });
}
