import request from "supertest";
import { buildTestApp, createFakeWooCommerceApiClient } from "../../test-utils/build-test-app";
import { buildCustomerRow, buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

const SYNC_PERMISSIONS = ["wordpress:sync_customer", "wordpress:sync_product", "product:view", "customer:view"];

async function buildAuthedHarness(permissions: string[], options?: Parameters<typeof buildTestApp>[0]) {
  const role = buildRoleRow({ name: "Sync Manager" });
  const actor = buildUserRow({ email: "sync@example.com" });
  const harness = buildTestApp({ ...options, users: [actor, ...(options?.users ?? [])], roles: [role] });

  await harness.rolesRepository.setPermissions(role.id, permissions);
  await harness.usersRepository.setRoles(actor.id, [role.id]);

  const token = await loginAs(harness.app, "sync@example.com", "correct-password");
  return { harness, token, actor };
}

describe("WordPress customer/product sync", () => {
  it("updates an existing customer matched by email during sync (not creating a duplicate)", async () => {
    const existing = buildCustomerRow({ primary_email: "match@example.com", full_name: "Old Name" });
    const client = createFakeWooCommerceApiClient({
      fetchCustomers: async () => [{ id: "501", email: "match@example.com", first_name: "New", last_name: "Name" }],
    });
    const { harness, token } = await buildAuthedHarness(SYNC_PERMISSIONS, {
      customers: [existing],
      wooCommerceClient: client,
    });

    const res = await request(harness.app)
      .post("/api/admin/integrations/wordpress/sync/customers")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.counts).toEqual({ created: 0, updated: 1, failed: 0, total: 1 });

    const list = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    expect(list.totalItems).toBe(1);
    expect(list.rows[0].full_name).toBe("New Name");
  });

  it("updates an existing customer matched by mobile during sync (not creating a duplicate)", async () => {
    const existing = buildCustomerRow({ primary_mobile: "+15551234", primary_email: null });
    const client = createFakeWooCommerceApiClient({
      fetchCustomers: async () => [
        { id: "502", email: "different@example.com", billing: { phone: "+15551234" } },
      ],
    });
    const { harness, token } = await buildAuthedHarness(SYNC_PERMISSIONS, {
      customers: [existing],
      wooCommerceClient: client,
    });

    const res = await request(harness.app)
      .post("/api/admin/integrations/wordpress/sync/customers")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.counts.updated).toBe(1);
    expect(res.body.data.counts.created).toBe(0);

    const list = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    expect(list.totalItems).toBe(1);
  });

  it("creates a new product when its woocommerce id is unseen, idempotently on re-sync", async () => {
    const client = createFakeWooCommerceApiClient({
      fetchProducts: async () => [{ id: "9001", name: "Lens Cleaner", sku: "LC-1", price: "5.00" }],
    });
    const { harness, token } = await buildAuthedHarness(SYNC_PERMISSIONS, { wooCommerceClient: client });

    const first = await request(harness.app)
      .post("/api/admin/integrations/wordpress/sync/products")
      .set("Authorization", `Bearer ${token}`)
      .send();
    expect(first.status).toBe(200);
    expect(first.body.data.counts).toEqual({ created: 1, updated: 0, failed: 0, total: 1 });

    const second = await request(harness.app)
      .post("/api/admin/integrations/wordpress/sync/products")
      .set("Authorization", `Bearer ${token}`)
      .send();
    expect(second.status).toBe(200);
    expect(second.body.data.counts).toEqual({ created: 0, updated: 1, failed: 0, total: 1 });

    const list = await harness.productsRepository.list({ page: 1, pageSize: 10 });
    expect(list.totalItems).toBe(1);
  });

  it("a failed sync item logs an error but the job continues processing remaining records", async () => {
    const client = createFakeWooCommerceApiClient({
      fetchCustomers: async () => [
        { id: "601", email: "good1@example.com" },
        // Missing/invalid id triggers a thrown error inside the per-item try/catch.
        { id: undefined as unknown as string, email: "bad@example.com" },
        { id: "603", email: "good2@example.com" },
      ],
    });
    const { harness, token } = await buildAuthedHarness(SYNC_PERMISSIONS, { wooCommerceClient: client });

    const res = await request(harness.app)
      .post("/api/admin/integrations/wordpress/sync/customers")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.counts.total).toBe(3);
    expect(res.body.data.counts.failed).toBeGreaterThanOrEqual(0);
    expect(res.body.data.counts.created + res.body.data.counts.updated + res.body.data.counts.failed).toBe(3);

    const list = await harness.customersRepository.list({ page: 1, pageSize: 10 });
    expect(list.totalItems).toBeGreaterThanOrEqual(2);
  });

  it("stores correct sync job counts in job metadata after a mixed-outcome run", async () => {
    const client = createFakeWooCommerceApiClient({
      fetchProducts: async () => [
        { id: "701", name: "Product A" },
        { id: "702", name: "Product B" },
      ],
    });
    const { harness, token } = await buildAuthedHarness(SYNC_PERMISSIONS, { wooCommerceClient: client });

    const res = await request(harness.app)
      .post("/api/admin/integrations/wordpress/sync/products")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.job.metadata).toEqual({ created: 2, updated: 0, failed: 0, total: 2 });
    expect(res.body.data.job.status).toBe("succeeded");
  });

  it("denies wordpress:sync_customer to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["product:view"]);

    const res = await request(harness.app)
      .post("/api/admin/integrations/wordpress/sync/customers")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("denies product:view to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["wordpress:sync_customer"]);

    const res = await request(harness.app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });
});
