import { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { decryptSecret, verifyPluginApiKey } from "../../common/crypto";
import { asyncHandler } from "../../common/async-handler";
import { sendError } from "../../common/response";
import { WordPressConnectionRepository } from "../wordpress/wordpress.repository";
import { CustomersRepository } from "../customers/customers.repository";

const SIGNATURE_MAX_DRIFT_MS = 5 * 60 * 1000;

export interface PluginAuthedRequest extends Request {
  vpCustomerId?: string;
}

export interface PluginAuthMiddlewareDeps {
  connectionRepository: WordPressConnectionRepository;
  customersRepository: CustomersRepository;
  encryptionKey: string;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Authenticates server-to-server requests from the WordPress plugin.
 * Three independent checks, all required:
 *
 * 1. Plugin API key (X-VP-Plugin-Api-Key) — verified against the hash
 *    stored on the WordPress connection row. Never compared/stored in
 *    plaintext, never echoed back.
 * 2. HMAC signature (X-VP-Signature) over `${method}:${path}:${timestamp}`
 *    using the connection's shared secret, with a 5-minute replay window
 *    (X-VP-Timestamp) — protects against a leaked API key being replayed
 *    from a different origin.
 * 3. WordPress user identity (X-VP-Wp-User-Id, optionally
 *    X-VP-Wp-User-Email / X-VP-Wp-User-Name) — mapped to (or used to
 *    lazily provision) a VisionPrime customer record. The resolved
 *    customer id is attached to the request; handlers never trust a
 *    customer id supplied directly by the caller.
 *
 * Failures are intentionally generic ("Unable to authenticate request.")
 * to avoid leaking which check failed.
 */
export function createPluginAuthMiddleware(deps: PluginAuthMiddlewareDeps) {
  return asyncHandler(async (req: PluginAuthedRequest, res: Response, next: NextFunction) => {
    const apiKey = req.header("X-VP-Plugin-Api-Key");
    const timestamp = req.header("X-VP-Timestamp");
    const signature = req.header("X-VP-Signature");
    const wpUserId = req.header("X-VP-Wp-User-Id");

    if (!apiKey || !timestamp || !signature || !wpUserId) {
      sendError(res, "PLUGIN_AUTH_FAILED", "Unable to authenticate request.", 401);
      return;
    }

    const connection = await deps.connectionRepository.get();
    if (!connection.plugin_api_key_hash || !connection.shared_secret_encrypted) {
      sendError(res, "PLUGIN_AUTH_FAILED", "Unable to authenticate request.", 401);
      return;
    }

    if (!verifyPluginApiKey(apiKey, connection.plugin_api_key_hash)) {
      sendError(res, "PLUGIN_AUTH_FAILED", "Unable to authenticate request.", 401);
      return;
    }

    const requestTime = Number(timestamp);
    if (!Number.isFinite(requestTime) || Math.abs(Date.now() - requestTime) > SIGNATURE_MAX_DRIFT_MS) {
      sendError(res, "PLUGIN_AUTH_FAILED", "Unable to authenticate request.", 401);
      return;
    }

    const sharedSecret = decryptSecret(connection.shared_secret_encrypted, deps.encryptionKey);
    const payload = `${req.method}:${req.path}:${timestamp}`;
    const expectedSignature = createHmac("sha256", sharedSecret).update(payload).digest("hex");

    if (!timingSafeStringEqual(expectedSignature, signature)) {
      sendError(res, "PLUGIN_AUTH_FAILED", "Unable to authenticate request.", 401);
      return;
    }

    const email = req.header("X-VP-Wp-User-Email") || null;
    const name = req.header("X-VP-Wp-User-Name") || null;

    let customer = await deps.customersRepository.findByMatchPriority({ wordpressUserId: wpUserId, email });
    if (!customer) {
      customer = await deps.customersRepository.create({
        fullName: name || email || `WordPress User ${wpUserId}`,
        primaryEmail: email,
        wordpressUserId: wpUserId,
        status: "active",
      });
    }

    req.vpCustomerId = customer.id;
    next();
  });
}
