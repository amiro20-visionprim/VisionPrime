import request from "supertest";
import { buildTestApp } from "../../test-utils/build-test-app";
import { buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

const ALL_PERMISSIONS = [
  "user:view",
  "user:create",
  "user:update",
  "user:delete",
] as const;

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

describe("Users controller", () => {
  it("permission denial returns the standard 403 error envelope", async () => {
    const actor = buildUserRow({ email: "noperms@example.com" });
    const harness = buildTestApp({ users: [actor] });

    const token = await loginAs(harness.app, "noperms@example.com", "correct-password");

    const res = await request(harness.app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("super admin can list, create, update, and delete users (CRUD happy path)", async () => {
    const actor = buildUserRow({ email: "super@example.com", is_super_admin: true });
    const harness = buildTestApp({ users: [actor] });
    const token = await loginAs(harness.app, "super@example.com", "correct-password");
    const authHeader = { Authorization: `Bearer ${token}` };

    const listRes = await request(harness.app).get("/api/admin/users").set(authHeader);
    expect(listRes.status).toBe(200);
    expect(listRes.body.meta.totalItems).toBe(1);

    const createRes = await request(harness.app)
      .post("/api/admin/users")
      .set(authHeader)
      .send({ email: "new@example.com", password: "a-strong-password", fullName: "New User" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.email).toBe("new@example.com");
    expect(createRes.body.data.password_hash).toBeUndefined();
    const createdId = createRes.body.data.id;

    const updateRes = await request(harness.app)
      .patch(`/api/admin/users/${createdId}`)
      .set(authHeader)
      .send({ fullName: "Updated Name" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.full_name).toBe("Updated Name");

    const deleteRes = await request(harness.app).delete(`/api/admin/users/${createdId}`).set(authHeader);
    expect(deleteRes.status).toBe(200);

    const getAfterDelete = await request(harness.app).get(`/api/admin/users/${createdId}`).set(authHeader);
    expect(getAfterDelete.status).toBe(404);
  });

  it("actor cannot delete their own account", async () => {
    const actor = buildUserRow({ email: "self@example.com", is_super_admin: true });
    const harness = buildTestApp({ users: [actor] });
    const token = await loginAs(harness.app, "self@example.com", "correct-password");

    const res = await request(harness.app)
      .delete(`/api/admin/users/${actor.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CANNOT_DELETE_SELF");
  });

  it("a non-super-admin actor cannot delete a super admin target", async () => {
    const role = buildRoleRow({ name: "User Manager" });
    const actor = buildUserRow({ email: "manager@example.com", is_super_admin: false });
    const superAdminTarget = buildUserRow({ email: "boss@example.com", is_super_admin: true });
    const harness = buildTestApp({ users: [actor, superAdminTarget], roles: [role] });

    await harness.rolesRepository.setPermissions(role.id, [...ALL_PERMISSIONS]);
    await harness.usersRepository.setRoles(actor.id, [role.id]);

    const token = await loginAs(harness.app, "manager@example.com", "correct-password");

    const res = await request(harness.app)
      .delete(`/api/admin/users/${superAdminTarget.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CANNOT_DELETE_SUPER_ADMIN");
  });
});
