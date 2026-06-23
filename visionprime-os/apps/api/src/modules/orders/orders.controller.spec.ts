import request from "supertest";
import { buildTestApp, createFakeWooCommerceApiClient } from "../../test-utils/build-test-app";
import { buildCustomerRow, buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

const ORDER_PERMISSIONS = ["order:view", "order:sync", "customer:view"];

async function buildAuthedHarness(permissions: string[], options?: Parameters<typeof buildTestApp>[0]) {
  const role = buildRoleRow({ name: "Order Manager" });
  const actor = buildUserRow({ email: "orders@example.com" });
  const harness = buildTestApp({ ...options, users: [actor, ...(options?.users ?? [])], roles: [role] });

  await harness.rolesRepository.setPermissions(role.id, permissions);
  await harness.usersRepository.setRoles(actor.id, [role.id]);

  const token = await loginAs(harness.app, "orders@example.com", "correct-password");
  return { harness, token, actor };
}

function remoteOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "8001",
    status: "completed",
    currency: "USD",
    total: "49.99",
    billing: { email: "buyer@example.com", first_name: "Buyer", last_name: "One" },
    line_items: [{ product_id: 1, name: "Frame", quantity: 1, price: "49.99", total: "49.99" }],
    date_created: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Orders sync + API", () => {
  it("order sync creates an order", async () => {
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder()] });
    const { harness, token } = await buildAuthedHarness(ORDER_PERMISSIONS, { wooCommerceClient: client });

    const res = await request(harness.app)
      .post("/api/admin/orders/sync-from-wordpress")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.counts).toEqual({ created: 1, updated: 0, failed: 0, total: 1 });

    const list = await request(harness.app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].woocommerce_order_id).toBe("8001");
  });

  it("does not duplicate the same WooCommerce order on re-sync", async () => {
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder()] });
    const { harness, token } = await buildAuthedHarness(ORDER_PERMISSIONS, { wooCommerceClient: client });

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();
    const second = await request(harness.app)
      .post("/api/admin/orders/sync-from-wordpress")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(second.body.data.counts).toEqual({ created: 0, updated: 1, failed: 0, total: 1 });

    const list = await request(harness.app).get("/api/admin/orders").set("Authorization", `Bearer ${token}`);
    expect(list.body.data).toHaveLength(1);
  });

  it("links the order to an existing customer matched by email", async () => {
    const existing = buildCustomerRow({ primary_email: "buyer@example.com", full_name: "Existing Buyer" });
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder()] });
    const { harness, token } = await buildAuthedHarness(ORDER_PERMISSIONS, {
      customers: [existing],
      wooCommerceClient: client,
    });

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const list = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    expect(list.totalItems).toBe(1);

    const orders = await harness.ordersRepository.listByCustomer(existing.id);
    expect(orders).toHaveLength(1);
  });

  it("creates a new customer when no match exists for the order", async () => {
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder()] });
    const { harness, token } = await buildAuthedHarness(ORDER_PERMISSIONS, { wooCommerceClient: client });

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const list = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    expect(list.totalItems).toBe(1);
    expect(list.rows[0].primary_email).toBe("buyer@example.com");
  });

  it("updates the existing order's status on re-sync after a status change", async () => {
    let status = "processing";
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder({ status })] });
    const { harness, token } = await buildAuthedHarness(ORDER_PERMISSIONS, { wooCommerceClient: client });

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();
    status = "completed";
    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const list = await request(harness.app).get("/api/admin/orders").set("Authorization", `Bearer ${token}`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].status).toBe("completed");
  });

  it("updates customer purchase metrics on a completed order", async () => {
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder()] });
    const { harness, token } = await buildAuthedHarness(ORDER_PERMISSIONS, { wooCommerceClient: client });

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const list = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    const customer = list.rows[0];
    expect(customer.purchase_count).toBe(1);
    expect(Number(customer.total_spent)).toBeCloseTo(49.99);
    expect(customer.last_purchase_at).not.toBeNull();
  });

  it("reverses customer purchase metrics when an order becomes cancelled/refunded", async () => {
    let status = "completed";
    const client = createFakeWooCommerceApiClient({ fetchOrders: async () => [remoteOrder({ status })] });
    const { harness, token } = await buildAuthedHarness(ORDER_PERMISSIONS, { wooCommerceClient: client });

    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();
    status = "refunded";
    await request(harness.app).post("/api/admin/orders/sync-from-wordpress").set("Authorization", `Bearer ${token}`).send();

    const list = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    const customer = list.rows[0];
    expect(customer.purchase_count).toBe(0);
    expect(Number(customer.total_spent)).toBeCloseTo(0);
  });

  it("denies order:view to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["order:sync"]);

    const res = await request(harness.app).get("/api/admin/orders").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("denies order:sync to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["order:view"]);

    const res = await request(harness.app)
      .post("/api/admin/orders/sync-from-wordpress")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });
});
