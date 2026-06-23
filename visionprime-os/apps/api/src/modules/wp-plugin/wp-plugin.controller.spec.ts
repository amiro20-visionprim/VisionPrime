import { createHmac } from "crypto";
import request from "supertest";
import { buildTestApp, TEST_PLUGIN_API_KEY, TEST_PLUGIN_SHARED_SECRET } from "../../test-utils/build-test-app";
import { buildCustomerRow } from "../../test-utils/fixtures";

function pluginHeaders(method: string, path: string, opts?: { wpUserId?: string; email?: string; name?: string; apiKey?: string; secret?: string }) {
  const timestamp = String(Date.now());
  const secret = opts?.secret ?? TEST_PLUGIN_SHARED_SECRET;
  const payload = `${method}:${path}:${timestamp}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const headers: Record<string, string> = {
    "X-VP-Plugin-Api-Key": opts?.apiKey ?? TEST_PLUGIN_API_KEY,
    "X-VP-Timestamp": timestamp,
    "X-VP-Signature": signature,
    "X-VP-Wp-User-Id": opts?.wpUserId ?? "wp-42",
  };
  if (opts?.email) headers["X-VP-Wp-User-Email"] = opts.email;
  if (opts?.name) headers["X-VP-Wp-User-Name"] = opts.name;
  return headers;
}

describe("WordPress plugin customer API", () => {
  it("resolves the WordPress user to a customer and returns the profile", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .get("/api/wp-plugin/customer/me")
      .set(pluginHeaders("GET", "/customer/me", { wpUserId: "wp-100", email: "plugin-buyer@example.com", name: "Plugin Buyer" }));

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("plugin-buyer@example.com");
    expect(res.body.data.fullName).toBe("Plugin Buyer");
  });

  it("maps the same WordPress user id to the same customer on repeat calls", async () => {
    const harness = buildTestApp();
    const first = await request(harness.app)
      .get("/api/wp-plugin/customer/me")
      .set(pluginHeaders("GET", "/customer/me", { wpUserId: "wp-200", email: "repeat@example.com" }));
    const second = await request(harness.app)
      .get("/api/wp-plugin/customer/me")
      .set(pluginHeaders("GET", "/customer/me", { wpUserId: "wp-200", email: "repeat@example.com" }));

    expect(first.body.data.id).toBe(second.body.data.id);
  });

  it("loads the wallet tab via AJAX (zero balance for a new customer)", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .get("/api/wp-plugin/customer/wallet")
      .set(pluginHeaders("GET", "/customer/wallet", { wpUserId: "wp-300" }));

    expect(res.status).toBe(200);
    expect(res.body.data.availableBalanceCents).toBe(0);
  });

  it("loads the points tab via AJAX (zero balance for a new customer)", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .get("/api/wp-plugin/customer/points")
      .set(pluginHeaders("GET", "/customer/points", { wpUserId: "wp-301" }));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ enabled: true, balance: 0, lifetimePoints: 0 });
  });

  it("loads the rewards tab via AJAX (empty for a new customer)", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .get("/api/wp-plugin/customer/rewards")
      .set(pluginHeaders("GET", "/customer/rewards", { wpUserId: "wp-302" }));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ enabled: true, claimed: [], available: [] });
  });

  it("loads the dashboard aggregate via AJAX", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .get("/api/wp-plugin/customer/dashboard")
      .set(pluginHeaders("GET", "/customer/dashboard", { wpUserId: "wp-303" }));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("me");
    expect(res.body.data).toHaveProperty("wallet");
    expect(res.body.data).toHaveProperty("points");
    expect(res.body.data).toHaveProperty("rewards");
    expect(res.body.data).toHaveProperty("tier");
  });

  it("rejects requests missing the plugin auth headers entirely", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app).get("/api/wp-plugin/customer/wallet");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects an invalid plugin API key", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .get("/api/wp-plugin/customer/wallet")
      .set(pluginHeaders("GET", "/customer/wallet", { wpUserId: "wp-400", apiKey: "wrong-key" }));
    expect(res.status).toBe(401);
  });

  it("rejects a request with an invalid HMAC signature", async () => {
    const harness = buildTestApp();
    const res = await request(harness.app)
      .get("/api/wp-plugin/customer/wallet")
      .set(pluginHeaders("GET", "/customer/wallet", { wpUserId: "wp-401", secret: "wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("links to an existing customer by wordpress_user_id rather than creating a duplicate", async () => {
    const existing = buildCustomerRow({ wordpress_user_id: "wp-500", primary_email: "existing@example.com" });
    const harness = buildTestApp({ customers: [existing] });
    const res = await request(harness.app)
      .get("/api/wp-plugin/customer/me")
      .set(pluginHeaders("GET", "/customer/me", { wpUserId: "wp-500", email: "existing@example.com" }));

    expect(res.body.data.id).toBe(existing.id);
  });
});
