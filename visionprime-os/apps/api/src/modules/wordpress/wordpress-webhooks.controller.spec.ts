import { createHmac } from "crypto";
import request from "supertest";
import { buildTestApp, TEST_INTEGRATION_ENCRYPTION_KEY } from "../../test-utils/build-test-app";
import { encryptSecret } from "../../common/crypto";

const SHARED_SECRET = "wc-shared-secret";

function signedBody(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  const signature = createHmac("sha256", SHARED_SECRET).update(raw).digest("base64");
  return { raw, signature };
}

function buildHarnessWithSharedSecret() {
  const harness = buildTestApp();
  return harness;
}

async function connectSharedSecret(harness: ReturnType<typeof buildTestApp>) {
  await harness.wordpressService.connect(
    {
      siteUrl: "https://example.test",
      consumerKey: "key",
      consumerSecret: "secret",
      sharedSecret: SHARED_SECRET,
    },
    "system",
  );
}

function remoteOrderPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 9100,
    status: "completed",
    currency: "USD",
    total: "19.99",
    billing: { email: "webhook-buyer@example.com", first_name: "Web", last_name: "Hook" },
    line_items: [{ product_id: 5, name: "Case", quantity: 1, price: "19.99", total: "19.99" }],
    date_created: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("WordPress order webhooks", () => {
  it("rejects a webhook with an invalid signature", async () => {
    const harness = buildHarnessWithSharedSecret();
    await connectSharedSecret(harness);
    const { raw } = signedBody(remoteOrderPayload());

    const res = await request(harness.app)
      .post("/api/webhooks/wordpress/order-created")
      .set("Content-Type", "application/json")
      .set("X-WC-Webhook-Signature", "invalid-signature")
      .send(raw);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_SIGNATURE");

    const events = await harness.wordpressWebhookEventRepository.list(1, 10);
    expect(events.rows[0].status).toBe("rejected");
  });

  it("processes a valid order-created webhook and creates the order", async () => {
    const harness = buildHarnessWithSharedSecret();
    await connectSharedSecret(harness);
    const { raw, signature } = signedBody(remoteOrderPayload());

    const res = await request(harness.app)
      .post("/api/webhooks/wordpress/order-created")
      .set("Content-Type", "application/json")
      .set("X-WC-Webhook-Signature", signature)
      .set("X-WC-Webhook-Delivery-ID", "delivery-1")
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);

    const orders = await harness.ordersRepository.list({ page: 1, pageSize: 10 });
    expect(orders.totalItems).toBe(1);
    expect(orders.rows[0].woocommerce_order_id).toBe("9100");
  });

  it("ignores a duplicate webhook delivery without reprocessing", async () => {
    const harness = buildHarnessWithSharedSecret();
    await connectSharedSecret(harness);
    const { raw, signature } = signedBody(remoteOrderPayload());

    await request(harness.app)
      .post("/api/webhooks/wordpress/order-created")
      .set("Content-Type", "application/json")
      .set("X-WC-Webhook-Signature", signature)
      .set("X-WC-Webhook-Delivery-ID", "delivery-dup")
      .send(raw);

    const second = await request(harness.app)
      .post("/api/webhooks/wordpress/order-created")
      .set("Content-Type", "application/json")
      .set("X-WC-Webhook-Signature", signature)
      .set("X-WC-Webhook-Delivery-ID", "delivery-dup")
      .send(raw);

    expect(second.status).toBe(200);
    expect(second.body.data.ignored).toBe(true);
    expect(second.body.data.reason).toBe("duplicate_delivery");

    const orders = await harness.ordersRepository.list({ page: 1, pageSize: 10 });
    expect(orders.totalItems).toBe(1);
  });

  it("is retry-safe when the same payload is redelivered with a different delivery id", async () => {
    const harness = buildHarnessWithSharedSecret();
    await connectSharedSecret(harness);
    const { raw, signature } = signedBody(remoteOrderPayload());

    await request(harness.app)
      .post("/api/webhooks/wordpress/order-created")
      .set("Content-Type", "application/json")
      .set("X-WC-Webhook-Signature", signature)
      .set("X-WC-Webhook-Delivery-ID", "delivery-a")
      .send(raw);

    await request(harness.app)
      .post("/api/webhooks/wordpress/order-created")
      .set("Content-Type", "application/json")
      .set("X-WC-Webhook-Signature", signature)
      .set("X-WC-Webhook-Delivery-ID", "delivery-b")
      .send(raw);

    const orders = await harness.ordersRepository.list({ page: 1, pageSize: 10 });
    expect(orders.totalItems).toBe(1);

    const customers = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    expect(customers.rows[0].purchase_count).toBe(1);
  });

  it("processes order-deleted webhook and reverses purchase metrics", async () => {
    const harness = buildHarnessWithSharedSecret();
    await connectSharedSecret(harness);

    const created = signedBody(remoteOrderPayload());
    await request(harness.app)
      .post("/api/webhooks/wordpress/order-created")
      .set("Content-Type", "application/json")
      .set("X-WC-Webhook-Signature", created.signature)
      .send(created.raw);

    const deleted = signedBody(remoteOrderPayload());
    const res = await request(harness.app)
      .post("/api/webhooks/wordpress/order-deleted")
      .set("Content-Type", "application/json")
      .set("X-WC-Webhook-Signature", deleted.signature)
      .send(deleted.raw);

    expect(res.status).toBe(200);

    const customers = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    expect(customers.rows[0].purchase_count).toBe(0);
  });
});
