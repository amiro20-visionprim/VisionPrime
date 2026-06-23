import request from "supertest";
import { buildTestApp } from "../../test-utils/build-test-app";
import { buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

describe("Roles controller", () => {
  it("a role manager can update a role's permission set", async () => {
    const role = buildRoleRow({ name: "Editor" });
    const managerRole = buildRoleRow({ name: "Role Manager" });
    const actor = buildUserRow({ email: "manager@example.com" });
    const harness = buildTestApp({ users: [actor], roles: [role, managerRole] });

    await harness.rolesRepository.setPermissions(managerRole.id, ["role:view", "role:update", "user:update", "permission:view"]);
    await harness.usersRepository.setRoles(actor.id, [managerRole.id]);

    const token = await loginAs(harness.app, "manager@example.com", "correct-password");

    const res = await request(harness.app)
      .patch(`/api/admin/roles/${role.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ permissionKeys: ["user:view", "user:create"] });

    expect(res.status).toBe(200);
    expect(res.body.data.permissionKeys.sort()).toEqual(["user:create", "user:view"]);

    const auditPage = await harness.auditService.listAuditLogs(1, 20);
    const permEntry = auditPage.rows.find((r) => r.action === "role.permissions_updated");
    expect(permEntry).toBeDefined();
  });

  it("blocks removing a critical permission the acting user depends on with no other source", async () => {
    const role = buildRoleRow({ name: "Sole Role" });
    const actor = buildUserRow({ email: "lonewolf@example.com" });
    const harness = buildTestApp({ users: [actor], roles: [role] });

    // Acting user's only role grants role:update (critical) + role:view —
    // stripping role:update here would lock them out of role management.
    await harness.rolesRepository.setPermissions(role.id, ["role:view", "role:update", "role:create"]);
    await harness.usersRepository.setRoles(actor.id, [role.id]);

    const token = await loginAs(harness.app, "lonewolf@example.com", "correct-password");

    const res = await request(harness.app)
      .patch(`/api/admin/roles/${role.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ permissionKeys: ["role:view", "role:create"] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CANNOT_REMOVE_CRITICAL_PERMISSION");
  });

  it("allows removing a critical permission if another role still grants it to the actor", async () => {
    const role = buildRoleRow({ name: "Role A" });
    const backupRole = buildRoleRow({ name: "Role B" });
    const actor = buildUserRow({ email: "doublecover@example.com" });
    const harness = buildTestApp({ users: [actor], roles: [role, backupRole] });

    await harness.rolesRepository.setPermissions(role.id, ["role:view", "role:update", "role:create"]);
    await harness.rolesRepository.setPermissions(backupRole.id, ["role:update"]);
    await harness.usersRepository.setRoles(actor.id, [role.id, backupRole.id]);

    const token = await loginAs(harness.app, "doublecover@example.com", "correct-password");

    const res = await request(harness.app)
      .patch(`/api/admin/roles/${role.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ permissionKeys: ["role:view", "role:create"] });

    expect(res.status).toBe(200);
  });

  it("cannot modify a system role", async () => {
    const systemRole = buildRoleRow({ name: "Super Admin", is_system: true });
    const actor = buildUserRow({ email: "super@example.com", is_super_admin: true });
    const harness = buildTestApp({ users: [actor], roles: [systemRole] });

    const token = await loginAs(harness.app, "super@example.com", "correct-password");

    const res = await request(harness.app)
      .patch(`/api/admin/roles/${systemRole.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ permissionKeys: ["user:view"] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CANNOT_MODIFY_SYSTEM_ROLE");
  });
});
