import request from "supertest";
import { buildTestApp } from "../../test-utils/build-test-app";
import { buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

describe("Business settings controller", () => {
  it("updating business settings writes an audit log", async () => {
    const role = buildRoleRow({ name: "Settings Manager" });
    const actor = buildUserRow({ email: "settings@example.com" });
    const harness = buildTestApp({ users: [actor], roles: [role] });

    await harness.rolesRepository.setPermissions(role.id, ["settings:view", "settings:manage"]);
    await harness.usersRepository.setRoles(actor.id, [role.id]);

    const token = await loginAs(harness.app, "settings@example.com", "correct-password");

    const res = await request(harness.app)
      .patch("/api/admin/settings/business")
      .set("Authorization", `Bearer ${token}`)
      .send({ businessName: "VisionPrime Store" });

    expect(res.status).toBe(200);
    expect(res.body.data.general.businessName).toBe("VisionPrime Store");

    const auditPage = await harness.auditService.listAuditLogs(1, 20);
    const entry = auditPage.rows.find((r) => r.action === "business_settings.update");
    expect(entry).toBeDefined();
    expect(entry?.actor_id).toBe(actor.id);
  });

  it("denies settings:manage to a caller lacking the permission", async () => {
    const role = buildRoleRow({ name: "Viewer" });
    const actor = buildUserRow({ email: "viewer@example.com" });
    const harness = buildTestApp({ users: [actor], roles: [role] });

    await harness.rolesRepository.setPermissions(role.id, ["settings:view"]);
    await harness.usersRepository.setRoles(actor.id, [role.id]);

    const token = await loginAs(harness.app, "viewer@example.com", "correct-password");

    const res = await request(harness.app)
      .patch("/api/admin/settings/business")
      .set("Authorization", `Bearer ${token}`)
      .send({ businessName: "Nope" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });
});
