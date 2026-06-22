import { createHmac } from "crypto";
import request from "supertest";
import { buildTestApp, TEST_PLUGIN_API_KEY, TEST_PLUGIN_SHARED_SECRET } from "../../test-utils/build-test-app";
import { buildCustomerRow, buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

function pluginHeaders(method: string, path: string, opts?: { wpUserId?: string; apiKey?: string; secret?: string; omit?: boolean }) {
  if (opts?.omit) return {};
  const timestamp = String(Date.now());
  const secret = opts?.secret ?? TEST_PLUGIN_SHARED_SECRET;
  const payload = `${method}:${path}:${timestamp}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return {
    "X-VP-Plugin-Api-Key": opts?.apiKey ?? TEST_PLUGIN_API_KEY,
    "X-VP-Timestamp": timestamp,
    "X-VP-Signature": signature,
    "X-VP-Wp-User-Id": opts?.wpUserId ?? "wp-checkout-1",
  };
}

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

async function buildAuthedHarness(permissions: string[]) {
  const role = buildRoleRow({ name: "Finance Manager" });
  const actor = buildUserRow({ email: "finance@example.com" });
  const customer = buildCustomerRow({ wordpress_user_id: "wp-checkout-1" });
  const harness = buildTestApp({ users: [actor], roles: [role], customers: [customer] });

  await harness.rolesRepository.setPermissions(role.id, permissions);
  await harness.usersRepository.setRoles(actor.id, [role.id]);

  const token = await loginAs(harness.app, "finance@example.com", "correct-password");
  return { harness, token, actor, customer };
}

async function credit(harness: ReturnType<typeof buildTestApp>, token: string, customerId: string, amount: number) {
  await request(harness.app)
    .post(`/api/admin/wallets/${customerId}/manual-credit`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount, reason: "Test credit" });
}

describe("Checkout wallet reservations", () => {
  it("applying a wallet amount creates an active reservation", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit"]);
    await credit(harness, token, customer.id, 50);

    const res = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-1", amount: 20 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("active");
    expect(res.body.data.amountCents).toBe(2000);
  });

  it("removing wallet (release) clears the active reservation without a ledger debit", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit", "wallet:view"]);
    await credit(harness, token, customer.id, 50);

    await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-2", amount: 20 });

    const release = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/release")
      .set(pluginHeaders("POST", "/checkout/wallet/release"))
      .send({ cartKey: "cart-2" });

    expect(release.status).toBe(200);
    expect(release.body.data.released).toBe(true);

    const wallet = await request(harness.app)
      .get("/api/admin/wallets/" + customer.id)
      .set("Authorization", `Bearer ${token}`);
    expect(wallet.body.data.availableBalanceCents).toBe(5000);
  });

  it("payment success (confirm) writes a wallet ledger debit and marks the reservation confirmed", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit", "wallet:view"]);
    await credit(harness, token, customer.id, 50);

    await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-3", amount: 20 });

    const confirm = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/confirm")
      .set(pluginHeaders("POST", "/checkout/wallet/confirm"))
      .send({ cartKey: "cart-3", woocommerceOrderId: "wc-1001" });

    expect(confirm.status).toBe(200);
    expect(confirm.body.data.status).toBe("confirmed");

    const wallet = await request(harness.app)
      .get("/api/admin/wallets/" + customer.id)
      .set("Authorization", `Bearer ${token}`);
    expect(wallet.body.data.availableBalanceCents).toBe(3000);
  });

  it("payment failure (release) leaves the wallet balance untouched", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit", "wallet:view"]);
    await credit(harness, token, customer.id, 50);

    await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-4", amount: 20 });

    await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/release")
      .set(pluginHeaders("POST", "/checkout/wallet/release"))
      .send({ cartKey: "cart-4" });

    const wallet = await request(harness.app)
      .get("/api/admin/wallets/" + customer.id)
      .set("Authorization", `Bearer ${token}`);
    expect(wallet.body.data.availableBalanceCents).toBe(5000);
  });

  it("a duplicate click with the same amount does not duplicate the reservation", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit"]);
    await credit(harness, token, customer.id, 50);

    const first = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-5", amount: 20 });

    const second = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-5", amount: 20 });

    expect(first.body.data.id).toBe(second.body.data.id);
  });

  it("reserving more than the available balance fails", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit"]);
    await credit(harness, token, customer.id, 10);

    const res = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-6", amount: 50 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INSUFFICIENT_BALANCE");
  });

  it("an expired reservation cannot be confirmed", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit"]);
    await credit(harness, token, customer.id, 50);

    const reserve = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-7", amount: 20 });

    const reservation = await harness.walletReservationRepository.findById(reserve.body.data.id);
    expect(reservation).not.toBeNull();
    // Force expiry by directly manipulating the in-memory row's expires_at.
    (reservation as { expires_at: string }).expires_at = new Date(Date.now() - 1000).toISOString();

    const confirm = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/confirm")
      .set(pluginHeaders("POST", "/checkout/wallet/confirm"))
      .send({ cartKey: "cart-7", woocommerceOrderId: "wc-2002" });

    expect(confirm.status).toBe(409);
    expect(confirm.body.error.code).toBe("RESERVATION_EXPIRED");
  });

  it("a wallet reservation cannot be confirmed twice", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit"]);
    await credit(harness, token, customer.id, 50);

    await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-8", amount: 20 });

    const firstConfirm = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/confirm")
      .set(pluginHeaders("POST", "/checkout/wallet/confirm"))
      .send({ cartKey: "cart-8", woocommerceOrderId: "wc-3003" });
    expect(firstConfirm.status).toBe(200);

    const secondConfirm = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/confirm")
      .set(pluginHeaders("POST", "/checkout/wallet/confirm"))
      .send({ cartKey: "cart-8", woocommerceOrderId: "wc-3003" });

    // No active reservation remains for the cart after confirm, so a
    // second confirm call finds nothing left to confirm.
    expect(secondConfirm.status).toBe(404);
  });

  it("rejects checkout AJAX calls missing the plugin auth headers (no nonce/signature)", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve", { omit: true }))
      .send({ cartKey: "cart-9", amount: 10 });

    expect(res.status).toBe(401);
  });

  it("rejects checkout AJAX calls for a logged-out / unresolvable customer (invalid plugin credentials)", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve", { apiKey: "wrong-key" }))
      .send({ cartKey: "cart-10", amount: 10 });

    expect(res.status).toBe(401);
  });

  it("validates the body and rejects a non-positive amount", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/validate")
      .set(pluginHeaders("POST", "/checkout/wallet/validate"))
      .send({ cartKey: "cart-11", amount: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("admin can list wallet reservations with the wallet_reservation:view permission", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit", "wallet_reservation:view"]);
    await credit(harness, token, customer.id, 50);

    await request(harness.app)
      .post("/api/wp-plugin/checkout/wallet/reserve")
      .set(pluginHeaders("POST", "/checkout/wallet/reserve"))
      .send({ cartKey: "cart-12", amount: 20 });

    const list = await request(harness.app)
      .get("/api/admin/wallet-reservations")
      .set("Authorization", `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("admin without wallet_reservation:view cannot list wallet reservations", async () => {
    const { harness, token } = await buildAuthedHarness(["wallet:manual_credit"]);

    const list = await request(harness.app)
      .get("/api/admin/wallet-reservations")
      .set("Authorization", `Bearer ${token}`);

    expect(list.status).toBe(403);
  });

  it("reward checkout validate without a claim id reports invalid rather than throwing", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .post("/api/wp-plugin/checkout/reward/validate")
      .set(pluginHeaders("POST", "/checkout/reward/validate"))
      .send({ cartKey: "cart-13" });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
  });
});
