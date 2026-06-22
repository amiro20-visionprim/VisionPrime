import request from "supertest";
import { buildTestApp } from "../../test-utils/build-test-app";
import { buildUserRow } from "../../test-utils/fixtures";

describe("Auth controller", () => {
  it("login success returns tokens and writes an audit log", async () => {
    const user = buildUserRow({ email: "admin@example.com" });
    const harness = buildTestApp({ users: [user] });

    const res = await request(harness.app)
      .post("/api/admin/auth/login")
      .send({ email: "admin@example.com", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe("admin@example.com");
    expect(res.body.data.user.password_hash).toBeUndefined();

    const auditPage = await harness.auditService.listAuditLogs(1, 20);
    const loginEntry = auditPage.rows.find((r) => r.action === "auth.login");
    expect(loginEntry).toBeDefined();
    expect(loginEntry?.actor_id).toBe(user.id);
  });

  it("login failure writes a security event and never reveals whether the email exists", async () => {
    const user = buildUserRow({ email: "admin@example.com" });
    const harness = buildTestApp({ users: [user] });

    const res = await request(harness.app)
      .post("/api/admin/auth/login")
      .send({ email: "admin@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");

    const securityPage = await harness.auditService.listSecurityEvents(1, 20);
    const failedLogin = securityPage.rows.find((r) => r.type === "login_failed");
    expect(failedLogin).toBeDefined();
    expect(failedLogin?.severity).toBe("warning");
    expect(failedLogin?.email).toBe("admin@example.com");
  });

  it("refresh rotates the session and issues a new token pair", async () => {
    const user = buildUserRow({ email: "admin@example.com" });
    const harness = buildTestApp({ users: [user] });

    const loginRes = await request(harness.app)
      .post("/api/admin/auth/login")
      .send({ email: "admin@example.com", password: "correct-password" });

    const originalRefreshToken = loginRes.body.data.refreshToken;

    const refreshRes = await request(harness.app)
      .post("/api/admin/auth/refresh")
      .send({ refreshToken: originalRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).not.toBe(originalRefreshToken);

    // The original (now-revoked) refresh token must no longer work.
    const replayRes = await request(harness.app)
      .post("/api/admin/auth/refresh")
      .send({ refreshToken: originalRefreshToken });
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe("AUTH_INVALID_TOKEN");
  });

  it("logout revokes the session so it can no longer be refreshed", async () => {
    const user = buildUserRow({ email: "admin@example.com" });
    const harness = buildTestApp({ users: [user] });

    const loginRes = await request(harness.app)
      .post("/api/admin/auth/login")
      .send({ email: "admin@example.com", password: "correct-password" });

    const refreshToken = loginRes.body.data.refreshToken;

    const logoutRes = await request(harness.app).post("/api/admin/auth/logout").send({ refreshToken });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data.success).toBe(true);

    const refreshAfterLogout = await request(harness.app).post("/api/admin/auth/refresh").send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
    expect(refreshAfterLogout.body.error.code).toBe("AUTH_INVALID_TOKEN");
  });

  it("GET /me requires auth and returns the standard error envelope when missing", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app).get("/api/admin/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("GET /me returns the profile, roles, and effective permissions for an authenticated user", async () => {
    const user = buildUserRow({ email: "admin@example.com" });
    const harness = buildTestApp({ users: [user] });

    const loginRes = await request(harness.app)
      .post("/api/admin/auth/login")
      .send({ email: "admin@example.com", password: "correct-password" });

    const meRes = await request(harness.app)
      .get("/api/admin/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.id).toBe(user.id);
    expect(meRes.body.data.permissions).toEqual([]);
  });
});
