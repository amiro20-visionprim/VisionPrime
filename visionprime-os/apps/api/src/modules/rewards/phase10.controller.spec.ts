import { createHmac } from "crypto";
import request from "supertest";
import { buildTestApp, createFakeWooCommerceApiClient } from "../../test-utils/build-test-app";
import { buildCustomerRow, buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

function pluginHeaders(method: string, path: string, opts?: { wpUserId?: string }) {
  const timestamp = String(Date.now());
  const payload = `${method}:${path}:${timestamp}`;
  const signature = createHmac("sha256", "test-plugin-shared-secret").update(payload).digest("hex");
  return {
    "X-VP-Plugin-Api-Key": "test-plugin-api-key",
    "X-VP-Timestamp": timestamp,
    "X-VP-Signature": signature,
    "X-VP-Wp-User-Id": opts?.wpUserId ?? "wp-loyalty-1",
  };
}

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

const ADMIN_PERMISSIONS = [
  "loyalty:view",
  "loyalty:manage",
  "points:view",
  "reward:view",
  "reward:create",
  "reward:update",
  "reward:delete",
  "reward_claim:view",
  "reward_redemption:view",
  "order:sync",
  "order:view",
  "customer:view",
];

async function buildAuthedHarness(permissions: string[], options?: Parameters<typeof buildTestApp>[0]) {
  const role = buildRoleRow({ name: "Loyalty Manager" });
  const actor = buildUserRow({ email: "loyalty@example.com" });
  const customer = buildCustomerRow({ wordpress_user_id: "wp-loyalty-1" });
  const harness = buildTestApp({
    ...options,
    users: [actor, ...(options?.users ?? [])],
    roles: [role],
    customers: [customer, ...(options?.customers ?? [])],
  });

  await harness.rolesRepository.setPermissions(role.id, permissions);
  await harness.usersRepository.setRoles(actor.id, [role.id]);

  const token = await loginAs(harness.app, "loyalty@example.com", "correct-password");
  return { harness, token, actor, customer };
}

function remoteOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "8001",
    status: "completed",
    currency: "USD",
    total: "100.00",
    billing: { email: "points-buyer@example.com", first_name: "Points", last_name: "Buyer" },
    line_items: [],
    date_created: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function createProgramWithTiers(harness: ReturnType<typeof buildTestApp>, token: string) {
  const program = await request(harness.app)
    .post("/api/admin/loyalty/programs")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Standard", isActive: true, pointsPerCurrencyUnit: 1 });

  await request(harness.app)
    .post("/api/admin/loyalty/tiers")
    .set("Authorization", `Bearer ${token}`)
    .send({ programId: program.body.data.id, name: "Bronze", minLifetimePoints: 0 });

  await request(harness.app)
    .post("/api/admin/loyalty/tiers")
    .set("Authorization", `Bearer ${token}`)
    .send({ programId: program.body.data.id, name: "Silver", minLifetimePoints: 100 });

  return program.body.data;
}

async function createReward(harness: ReturnType<typeof buildTestApp>, token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(harness.app)
    .post("/api/admin/rewards")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Free Coffee", rewardType: "free_item", pointsCost: 10, claimValidityDays: 30, isActive: true, ...overrides });
  return res.body.data;
}

describe("Phase 10: loyalty, points, rewards", () => {
  it("an order creates points exactly once, even on re-sync", async () => {
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder()] });
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS, { wooCommerceClient: client });
    await createProgramWithTiers(harness, token);

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();
    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const customers = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    const buyer = customers.rows.find((c) => c.primary_email === "points-buyer@example.com")!;

    const ledger = await request(harness.app)
      .get(`/api/admin/points/customer/${buyer.id}/ledger`)
      .set("Authorization", `Bearer ${token}`);
    const purchaseEntries = ledger.body.data.filter((e: { type: string }) => e.type === "purchase");
    expect(purchaseEntries).toHaveLength(1);
    expect(purchaseEntries[0].points).toBe(100);
  });

  it("a refund/cancel reverses previously-awarded points", async () => {
    let status = "completed";
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder({ status })] });
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS, { wooCommerceClient: client });
    await createProgramWithTiers(harness, token);

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();
    status = "refunded";
    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const customers = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    const buyer = customers.rows.find((c) => c.primary_email === "points-buyer@example.com")!;

    const balance = await request(harness.app)
      .get(`/api/admin/points/customer/${buyer.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(balance.body.data.balance).toBe(0);
  });

  it("a customer crossing the tier threshold is upgraded", async () => {
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder({ total: "150.00" })] });
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS, { wooCommerceClient: client });
    await createProgramWithTiers(harness, token);

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const customers = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    const buyer = customers.rows.find((c) => c.primary_email === "points-buyer@example.com")!;

    const status = await harness.loyaltyService.getCustomerStatus(buyer.id);
    expect(status.currentTier?.name).toBe("Silver");

    const tierChangeLog = await harness.auditService.listAuditLogs(1, 20);
    expect(tierChangeLog.rows.some((l) => l.action === "loyalty.tier_change")).toBe(true);
  });

  it("a reward can be claimed and debits points from the customer's ledger", async () => {
    const { harness, token, customer } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    await harness.pointsRepository.recordEntry({
      customerId: customer.id,
      type: "manual",
      direction: "credit",
      points: 50,
      reason: "seed",
    });
    const reward = await createReward(harness, token);

    const res = await request(harness.app)
      .post(`/api/wp-plugin/rewards/${reward.id}/claim`)
      .set(pluginHeaders("POST", `/rewards/${reward.id}/claim`));

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("claimed");

    const balance = await harness.pointsService.getBalance(customer.id);
    expect(balance.balance).toBe(40);
  });

  it("an expired reward claim cannot be redeemed", async () => {
    const { harness, customer } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    // claimValidityDays is negative here only to backdate expiresAt for the
    // test — the admin API's positive-only validation prevents this in
    // practice; we go straight through the repository to simulate time
    // having passed since a real claim.
    const reward = await harness.rewardsRepository.createReward({
      name: "Free Coffee",
      rewardType: "free_item",
      pointsCost: 0,
      claimValidityDays: -1,
      isActive: true,
    });
    const claim = await harness.rewardsService.claimReward(reward.id, customer.id);

    const res = await request(harness.app)
      .post(`/api/wp-plugin/rewards/${claim.id}/redeem`)
      .set(pluginHeaders("POST", `/rewards/${claim.id}/redeem`));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("REWARD_CLAIM_EXPIRED");
  });

  it("a redeemed reward claim cannot be redeemed a second time", async () => {
    const { harness, token, customer } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const reward = await createReward(harness, token, { pointsCost: 0 });
    const claim = await harness.rewardsService.claimReward(reward.id, customer.id);

    const headers = pluginHeaders("POST", `/rewards/${claim.id}/redeem`);
    const first = await request(harness.app).post(`/api/wp-plugin/rewards/${claim.id}/redeem`).set(headers);
    expect(first.status).toBe(200);

    const second = await request(harness.app)
      .post(`/api/wp-plugin/rewards/${claim.id}/redeem`)
      .set(pluginHeaders("POST", `/rewards/${claim.id}/redeem`));
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("REWARD_ALREADY_REDEEMED");
  });

  it("a claim cannot be redeemed by a customer who does not own it", async () => {
    const otherCustomer = buildCustomerRow({ wordpress_user_id: "wp-other-1" });
    const { harness, token, customer } = await buildAuthedHarness(ADMIN_PERMISSIONS, { customers: [otherCustomer] });
    const reward = await createReward(harness, token, { pointsCost: 0 });
    const claim = await harness.rewardsService.claimReward(reward.id, customer.id);

    const res = await request(harness.app)
      .post(`/api/wp-plugin/rewards/${claim.id}/redeem`)
      .set(pluginHeaders("POST", `/rewards/${claim.id}/redeem`, { wpUserId: "wp-other-1" }));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("REWARD_OWNERSHIP_INVALID");
  });

  it("a duplicate claim attempt does not produce two point debits for the same claim", async () => {
    const { harness, customer } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    await harness.pointsRepository.recordEntry({
      customerId: customer.id,
      type: "manual",
      direction: "credit",
      points: 100,
      reason: "seed",
    });
    const reward = await harness.rewardsRepository.createReward({
      name: "Free Coffee",
      rewardType: "free_item",
      pointsCost: 10,
      claimValidityDays: 30,
      isActive: true,
    });

    await Promise.all([
      harness.rewardsService.claimReward(reward.id, customer.id),
      harness.rewardsService.claimReward(reward.id, customer.id),
    ]);

    const ledger = await harness.pointsRepository.listLedgerByCustomer(customer.id, { page: 1, pageSize: 50 });
    const debits = ledger.rows.filter((r) => r.type === "reward_claim");
    expect(debits).toHaveLength(2);
    const uniqueIdempotencyKeys = new Set(debits.map((d) => d.idempotency_key));
    expect(uniqueIdempotencyKeys.size).toBe(2);
  });

  it("a reward can be applied to a cart via the checkout reservation flow (AJAX)", async () => {
    const { harness, token, customer } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const reward = await createReward(harness, token, { pointsCost: 0 });
    const claim = await harness.rewardsService.claimReward(reward.id, customer.id);

    const reserve = await request(harness.app)
      .post("/api/wp-plugin/checkout/reward/reserve")
      .set(pluginHeaders("POST", "/checkout/reward/reserve"))
      .send({ cartKey: "cart-reward-1", rewardId: claim.id });

    expect(reserve.status).toBe(201);
    expect(reserve.body.data.status).toBe("active");

    const confirm = await request(harness.app)
      .post("/api/wp-plugin/checkout/reward/confirm")
      .set(pluginHeaders("POST", "/checkout/reward/confirm"))
      .send({ cartKey: "cart-reward-1", woocommerceOrderId: "9999" });

    expect(confirm.status).toBe(200);
    expect(confirm.body.data.status).toBe("confirmed");

    const status = await harness.rewardsService.redeemReward(claim.id, customer.id).catch((e) => e);
    expect(status).toBeInstanceOf(Error);
  });

  it("admin can fetch a customer's loyalty status via the dedicated endpoint", async () => {
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder({ total: "150.00" })] });
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS, { wooCommerceClient: client });
    await createProgramWithTiers(harness, token);
    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const customers = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    const buyer = customers.rows.find((c) => c.primary_email === "points-buyer@example.com")!;

    const res = await request(harness.app)
      .get(`/api/admin/loyalty/customer/${buyer.id}/status`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.currentTier.name).toBe("Silver");
  });

  it("denies reward:create to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["reward:view"]);
    const res = await request(harness.app)
      .post("/api/admin/rewards")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Free Coffee", rewardType: "free_item" });
    expect(res.status).toBe(403);
  });

  it("denies loyalty:manage to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["loyalty:view"]);
    const res = await request(harness.app)
      .post("/api/admin/loyalty/programs")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Standard" });
    expect(res.status).toBe(403);
  });
});
