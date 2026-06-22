import express, { Request, Router } from "express";
import { decryptSecret, verifyWebhookSignature } from "../../common/crypto";
import { asyncHandler } from "../../common/async-handler";
import { sendError, sendSuccess } from "../../common/response";
import { WordPressConnectionRepository, WordPressWebhookEventRepository } from "./wordpress.repository";
import { WordPressSyncService } from "./wordpress-sync.service";
import { RemoteWooCommerceOrder } from "./wordpress-sync.types";

export interface WordPressWebhooksControllerDeps {
  connectionRepository: WordPressConnectionRepository;
  webhookEventRepository: WordPressWebhookEventRepository;
  syncService: WordPressSyncService;
  encryptionKey: string;
}

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Public, unauthenticated-by-JWT receiver for WooCommerce order webhooks
 * (order-created/order-updated/order-deleted). Authenticated instead by
 * HMAC-SHA256 signature (X-WC-Webhook-Signature header, verified against
 * the connection's shared secret) — never processed unverified.
 *
 * Every delivery is stored in wordpress_webhook_events BEFORE any
 * processing happens, so even a crash mid-processing leaves an audit
 * trail. Duplicate deliveries (same X-WC-Webhook-Delivery-ID) are
 * detected and ignored without reprocessing. Order upserts themselves
 * are idempotent (see WordPressSyncService.upsertOrderFromRemote), so
 * processing is retry-safe even without the dedup check.
 */
export function createWordPressWebhooksRouter(deps: WordPressWebhooksControllerDeps): Router {
  const router = Router();

  // Scoped JSON body parser that retains the raw bytes for signature
  // verification — must run before any other body parser for this path.
  router.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf;
      },
    }),
  );

  function handler(eventType: "order.created" | "order.updated" | "order.deleted") {
    return asyncHandler(async (req: RequestWithRawBody, res) => {
      const deliveryId = (req.header("X-WC-Webhook-Delivery-ID") || req.header("X-Wc-Webhook-Delivery-Id")) ?? null;
      const signature = req.header("X-WC-Webhook-Signature");

      if (deliveryId) {
        const existing = await deps.webhookEventRepository.findByDeliveryId(deliveryId);
        if (existing) {
          sendSuccess(res, { ignored: true, reason: "duplicate_delivery" });
          return;
        }
      }

      const connection = await deps.connectionRepository.get();
      const sharedSecret = connection.shared_secret_encrypted
        ? decryptSecret(connection.shared_secret_encrypted, deps.encryptionKey)
        : null;

      const isValid = Boolean(sharedSecret) && verifyWebhookSignature(req.rawBody ?? Buffer.from(""), signature, sharedSecret!);

      // Stored before processing, regardless of validity — every delivery
      // attempt is auditable.
      const event = await deps.webhookEventRepository.insert({
        event_type: eventType,
        status: isValid ? "received" : "rejected",
        detail: isValid ? null : "Invalid or missing webhook signature.",
        metadata: { body: req.body },
        delivery_id: deliveryId,
      });

      if (!isValid) {
        sendError(res, "INVALID_SIGNATURE", "Invalid or missing webhook signature.", 401);
        return;
      }

      try {
        const remoteOrder = req.body as RemoteWooCommerceOrder;
        if (eventType === "order.deleted") {
          await deps.syncService.markOrderDeleted(String(remoteOrder.id));
        } else {
          await deps.syncService.upsertOrderFromRemote(remoteOrder);
        }
        await deps.webhookEventRepository.updateStatus(event.id, "processed");
      } catch {
        await deps.webhookEventRepository.updateStatus(event.id, "failed", "Failed to process the order payload.");
        // Per "failed record logs error but does not break full sync" —
        // the failure is recorded, but we still ack the webhook (2xx) so
        // WooCommerce doesn't endlessly retry a payload that will never
        // succeed; the stored event remains visible for investigation.
      }

      sendSuccess(res, { received: true });
    });
  }

  router.post("/order-created", handler("order.created"));
  router.post("/order-updated", handler("order.updated"));
  router.post("/order-deleted", handler("order.deleted"));

  return router;
}
