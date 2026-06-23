import request from "supertest";
import { buildTestApp, createFakeWooCommerceApiClient } from "../../test-utils/build-test-app";
import { buildCustomerRow, buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

const WALLET_PERMISSIONS = [
  "wallet:view",
  "wallet:manual_credit",
  "wallet:manual_debit",
  "wallet:reverse",
  "wallet:report:view",
  "order:sync",
  "order:view",
  "customer:view",
];

async function buildAuthedHarness(permissions: string[], options?: Parameters<typeof buildTestApp>[0]) {
  const role = buildRoleRow({ name: "Finance Manager" });
  const actor = buildUserRow({ email: "finance@example.com" });
  const customer = buildCustomerRow();
  const harness = buildTestApp({ ...options, users: [actor, ...(options?.users ?? [])], roles: [role], customers: [customer, ...(options?.customers ?? [])] });

  await harness.rolesRepository.setPermissions(role.id, permissions);
  await harness.usersRepository.setRoles(actor.id, [role.id]);

  const token = await loginAs(harness.app, "finance@example.com", "correct-password");
  return { harness, token, actor, customer };
}

function remoteOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "9001",
    status: "completed",
    currency: "USD",
    total: "100.00",
    billing: { email: "cashback-buyer@example.com", first_name: "Cash", last_name: "Back" },
    line_items: [],
    date_created: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Wallet ledger + API", () => {
  it("calculates balance from the ledger (credit then debit)", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);

    await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 50, reason: "Goodwill credit" });

    await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-debit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 20, reason: "Manual correction" });

    const res = await request(harness.app)
      .get(`/api/admin/wallets/${customer.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.availableBalanceCents).toBe(3000);
  });

  it("manual credit creates a credit ledger entry", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);

    const res = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10, reason: "Welcome bonus" });

    expect(res.status).toBe(201);
    expect(res.body.data.entry.direction).toBe("credit");
    expect(res.body.data.entry.type).toBe("manual_credit");
    expect(res.body.data.entry.amount_cents).toBe(1000);
  });

  it("manual debit creates a debit ledger entry", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);
    await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10, reason: "seed" });

    const res = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-debit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 5, reason: "Manual debit" });

    expect(res.status).toBe(201);
    expect(res.body.data.entry.direction).toBe("debit");
    expect(res.body.data.entry.type).toBe("manual_debit");
  });

  it("rejects a debit exceeding the available balance", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);

    const res = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-debit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 5, reason: "Overdraw attempt" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INSUFFICIENT_BALANCE");
  });

  it("requires a reason for manual credit", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);

    const res = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("never exposes a delete capability for ledger entries (no such route)", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);
    const credit = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10, reason: "seed" });

    const res = await request(harness.app)
      .delete(`/api/admin/wallets/ledger/${credit.body.data.entry.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("reversal creates an opposite-direction entry and restores balance", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);
    const credit = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 30, reason: "seed" });

    const res = await request(harness.app)
      .post(`/api/admin/wallets/ledger/${credit.body.data.entry.id}/reverse`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Mistaken credit" });

    expect(res.status).toBe(200);
    expect(res.body.data.entry.direction).toBe("debit");
    expect(res.body.data.entry.type).toBe("reversal");
    expect(res.body.data.balanceCents).toBe(0);
  });

  it("cannot reverse the same ledger entry twice", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);
    const credit = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 30, reason: "seed" });

    await request(harness.app)
      .post(`/api/admin/wallets/ledger/${credit.body.data.entry.id}/reverse`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "first reversal" });

    const second = await request(harness.app)
      .post(`/api/admin/wallets/ledger/${credit.body.data.entry.id}/reverse`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "second reversal" });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("ALREADY_REVERSED");
  });

  it("does not duplicate cashback for the same WooCommerce order on re-sync", async () => {
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder()] });
    const { harness, token } = await buildAuthedHarness(WALLET_PERMISSIONS, { wooCommerceClient: client });
    await harness.walletRepository.__seedRule({ rule_type: "cashback_percentage", config: { percentage: 10 }, is_active: true });

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();
    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const customers = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    const buyer = customers.rows.find((c) => c.primary_email === "cashback-buyer@example.com");
    const ledger = await request(harness.app)
      .get(`/api/admin/wallets/${buyer!.id}/ledger`)
      .set("Authorization", `Bearer ${token}`);

    const cashbackEntries = ledger.body.data.filter((e: { type: string }) => e.type === "cashback");
    expect(cashbackEntries).toHaveLength(1);
    expect(cashbackEntries[0].amount_cents).toBe(1000);
  });

  it("reverses cashback when an order becomes cancelled/refunded", async () => {
    let status = "completed";
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder({ status })] });
    const { harness, token } = await buildAuthedHarness(WALLET_PERMISSIONS, { wooCommerceClient: client });
    await harness.walletRepository.__seedRule({ rule_type: "cashback_percentage", config: { percentage: 10 }, is_active: true });

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();
    status = "refunded";
    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const customers = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    const buyer = customers.rows.find((c) => c.primary_email === "cashback-buyer@example.com");
    const wallet = await request(harness.app)
      .get(`/api/admin/wallets/${buyer!.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(wallet.body.data.availableBalanceCents).toBe(0);
  });

  it("records a financial audit log entry for a manual credit", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);

    await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10, reason: "Welcome bonus" });

    const logs = await harness.auditService.listAuditLogs(1, 20);
    expect(logs.rows.some((log) => log.action === "wallet.manual_credit")).toBe(true);
  });

  it("denies wallet:view to a caller lacking the permission", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:manual_credit"]);

    const res = await request(harness.app)
      .get(`/api/admin/wallets/${customer.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("denies wallet:manual_credit to a caller lacking the permission", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:view"]);

    const res = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10, reason: "x" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("denies wallet:manual_debit to a caller lacking the permission", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:view"]);

    const res = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-debit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10, reason: "x" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("denies wallet:reverse to a caller lacking the permission", async () => {
    const { harness, token, customer } = await buildAuthedHarness(["wallet:view", "wallet:manual_credit"]);
    const credit = await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10, reason: "x" });

    const res = await request(harness.app)
      .post(`/api/admin/wallets/ledger/${credit.body.data.entry.id}/reverse`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "x" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("denies wallet:report:view to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["wallet:view"]);

    const res = await request(harness.app)
      .get(`/api/admin/wallets/reports/liability`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("liability report sums all wallet balances", async () => {
    const { harness, token, customer } = await buildAuthedHarness(WALLET_PERMISSIONS);

    await request(harness.app)
      .post(`/api/admin/wallets/${customer.id}/manual-credit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 15, reason: "seed" });

    const res = await request(harness.app)
      .get(`/api/admin/wallets/reports/liability`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalLiabilityCents).toBe(1500);
    expect(res.body.data.walletCount).toBe(1);
  });
});
