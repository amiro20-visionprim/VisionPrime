import request from "supertest";
import { buildTestApp } from "../../test-utils/build-test-app";
import { buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

const ALL_WORDPRESS_PERMISSIONS = [
  "wordpress:view",
  "wordpress:connect",
  "wordpress:update",
  "wordpress:test",
  "wordpress:webhook_register",
  "wordpress:sync_job:view",
  "wordpress:sync_log:view",
];

describe("WordPress connection controller", () => {
  async function buildAuthedHarness(permissions: string[]) {
    const role = buildRoleRow({ name: "Integration Manager" });
    const actor = buildUserRow({ email: "wp@example.com" });
    const harness = buildTestApp({ users: [actor], roles: [role] });

    await harness.rolesRepository.setPermissions(role.id, permissions);
    await harness.usersRepository.setRoles(actor.id, [role.id]);

    const token = await loginAs(harness.app, "wp@example.com", "correct-password");
    return { harness, token, actor };
  }

  it("saves a connection and never returns the raw secrets", async () => {
    const { harness, token } = await buildAuthedHarness(ALL_WORDPRESS_PERMISSIONS);

    const res = await request(harness.app)
      .post("/api/admin/integrations/wordpress/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({
        siteUrl: "https://shop.example.com",
        consumerKey: "ck_secret_value_123",
        consumerSecret: "cs_secret_value_456",
        sharedSecret: "shared_secret_789",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.siteUrl).toBe("https://shop.example.com");
    expect(res.body.data.hasConsumerKey).toBe(true);
    expect(res.body.data.hasConsumerSecret).toBe(true);
    expect(res.body.data.hasSharedSecret).toBe(true);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("ck_secret_value_123");
    expect(serialized).not.toContain("cs_secret_value_456");
    expect(serialized).not.toContain("shared_secret_789");
    expect(res.body.data.consumerKey).toBeUndefined();
    expect(res.body.data.consumerSecret).toBeUndefined();
  });

  it("returns a generic masked error when the test connection fails", async () => {
    const { harness, token } = await buildAuthedHarness(ALL_WORDPRESS_PERMISSIONS);

    await request(harness.app)
      .post("/api/admin/integrations/wordpress/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({
        siteUrl: "https://unreachable.invalid",
        consumerKey: "ck_x",
        consumerSecret: "cs_x",
      });

    const res = await request(harness.app)
      .post("/api/admin/integrations/wordpress/test-connection")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.lastTestSuccess).toBe(false);
    expect(res.body.data.status).toBe("error");
    expect(res.body.data.lastTestMessage).not.toMatch(/ENOTFOUND|ECONNREFUSED|fetch failed/i);
  });

  it("denies wordpress:update to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["wordpress:view"]);

    const res = await request(harness.app)
      .patch("/api/admin/integrations/wordpress/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ settings: { syncEnabled: true } });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("writes an audit log when the connection is updated", async () => {
    const { harness, token, actor } = await buildAuthedHarness(ALL_WORDPRESS_PERMISSIONS);

    await request(harness.app)
      .patch("/api/admin/integrations/wordpress/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ siteUrl: "https://updated.example.com" });

    const auditPage = await harness.auditService.listAuditLogs(1, 20);
    const entry = auditPage.rows.find((r) => r.action === "wordpress_connection.update");
    expect(entry).toBeDefined();
    expect(entry?.actor_id).toBe(actor.id);
  });

  it("returns a paginated response for sync jobs and sync logs", async () => {
    const { harness, token } = await buildAuthedHarness(ALL_WORDPRESS_PERMISSIONS);

    const jobsRes = await request(harness.app)
      .get("/api/admin/integrations/wordpress/sync/jobs")
      .set("Authorization", `Bearer ${token}`);
    expect(jobsRes.status).toBe(200);
    expect(jobsRes.body.meta).toEqual({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });

    const logsRes = await request(harness.app)
      .get("/api/admin/integrations/wordpress/sync/logs")
      .set("Authorization", `Bearer ${token}`);
    expect(logsRes.status).toBe(200);
    expect(logsRes.body.meta).toEqual({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
  });
});
