import request from "supertest";
import { buildTestApp } from "../../test-utils/build-test-app";
import { buildCustomerRow, buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

const ADMIN_PERMISSIONS = [
  "segment:view",
  "segment:create",
  "segment:update",
  "segment:delete",
  "segment:evaluate",
  "campaign:view",
  "campaign:create",
  "campaign:update",
  "campaign:delete",
  "campaign:send",
  "campaign:report:view",
  "message_template:view",
  "message_template:manage",
  "notification_provider:view",
  "notification_provider:manage",
  "customer:view",
];

async function buildAuthedHarness(permissions: string[], options?: Parameters<typeof buildTestApp>[0]) {
  const role = buildRoleRow({ name: "Marketing Manager" });
  const actor = buildUserRow({ email: "marketing@example.com" });
  const harness = buildTestApp({
    ...options,
    users: [actor, ...(options?.users ?? [])],
    roles: [role],
  });

  await harness.rolesRepository.setPermissions(role.id, permissions);
  await harness.usersRepository.setRoles(actor.id, [role.id]);

  const token = await loginAs(harness.app, "marketing@example.com", "correct-password");
  return { harness, token, actor };
}

async function createStaticSegment(harness: ReturnType<typeof buildTestApp>, token: string, memberCustomerIds: string[]) {
  const res = await request(harness.app)
    .post("/api/admin/segments")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Static Segment", segmentType: "static", memberCustomerIds });
  return res.body.data;
}

async function createDynamicSegment(harness: ReturnType<typeof buildTestApp>, token: string, conditions: unknown[]) {
  const res = await request(harness.app)
    .post("/api/admin/segments")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Dynamic Segment", segmentType: "dynamic", conditions });
  return res.body.data;
}

async function createCampaign(
  harness: ReturnType<typeof buildTestApp>,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await request(harness.app)
    .post("/api/admin/campaigns")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Test Campaign", channel: "email", ...overrides });
  return res.body.data;
}

describe("Phase 11: segments, campaigns, notifications", () => {
  it("a dynamic segment evaluates correctly against condition criteria", async () => {
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS);

    const cityA = await harness.customersRepository.create({ fullName: "City A Customer", primaryEmail: "citya@example.com" });
    const cityB = await harness.customersRepository.create({ fullName: "City B Customer", primaryEmail: "cityb@example.com" });

    // Directly seed city via the underlying rows since there's no admin API
    // field for it yet — segments evaluation reads CustomerRow.city directly.
    const allRows = await harness.customersRepository.list({ page: 1, pageSize: 100 });
    const rowA = allRows.rows.find((r) => r.id === cityA.id)!;
    const rowB = allRows.rows.find((r) => r.id === cityB.id)!;
    rowA.city = "Cairo";
    rowB.city = "Alexandria";

    const segment = await createDynamicSegment(harness, token, [
      { conditionType: "city", operator: "eq", value: { value: "Cairo" } },
    ]);

    const evalRes = await request(harness.app)
      .post(`/api/admin/segments/${segment.id}/evaluate`)
      .set("Authorization", `Bearer ${token}`);

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.data.memberCount).toBe(1);

    const members = await request(harness.app)
      .get(`/api/admin/segments/${segment.id}/members`)
      .set("Authorization", `Bearer ${token}`);
    expect(members.body.data.map((m: { customerId: string }) => m.customerId)).toEqual([cityA.id]);
  });

  it("a static segment stores its explicit member list", async () => {
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const customer = await harness.customersRepository.create({ fullName: "Static Member", primaryEmail: "static@example.com" });

    const segment = await createStaticSegment(harness, token, [customer.id]);

    const members = await request(harness.app)
      .get(`/api/admin/segments/${segment.id}/members`)
      .set("Authorization", `Bearer ${token}`);
    expect(members.body.data).toHaveLength(1);
    expect(members.body.data[0].customerId).toBe(customer.id);
  });

  it("a dynamic segment recalculates membership when conditions are re-evaluated", async () => {
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const customer = await harness.customersRepository.create({ fullName: "Changing City", primaryEmail: "changing@example.com" });
    const allRows = await harness.customersRepository.list({ page: 1, pageSize: 100 });
    const row = allRows.rows.find((r) => r.id === customer.id)!;
    row.city = "Cairo";

    const segment = await createDynamicSegment(harness, token, [
      { conditionType: "city", operator: "eq", value: { value: "Cairo" } },
    ]);

    let evalRes = await request(harness.app)
      .post(`/api/admin/segments/${segment.id}/evaluate`)
      .set("Authorization", `Bearer ${token}`);
    expect(evalRes.body.data.memberCount).toBe(1);

    row.city = "Alexandria";
    evalRes = await request(harness.app)
      .post(`/api/admin/segments/${segment.id}/evaluate`)
      .set("Authorization", `Bearer ${token}`);
    expect(evalRes.body.data.memberCount).toBe(0);
  });

  it("a campaign send excludes opted-out customers from recipients", async () => {
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const optedOut = await harness.customersRepository.create({ fullName: "Opted Out", primaryEmail: "optedout@example.com" });
    const eligible = await harness.customersRepository.create({ fullName: "Eligible", primaryEmail: "eligible@example.com" });

    await harness.notificationsService.createOptOut({ customerId: optedOut.id, channel: "email" }, { userId: "system" });

    const segment = await createStaticSegment(harness, token, [optedOut.id, eligible.id]);
    const campaign = await createCampaign(harness, token, { segmentId: segment.id });

    const preview = await request(harness.app)
      .post(`/api/admin/campaigns/${campaign.id}/preview`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(preview.body.data.eligibleRecipientCount).toBe(1);
    expect(preview.body.data.sampleRecipientIds).toEqual([eligible.id]);
  });

  it("a campaign send excludes suppressed customers from recipients", async () => {
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const suppressed = await harness.customersRepository.create({ fullName: "Suppressed", primaryEmail: "suppressed@example.com" });
    const eligible = await harness.customersRepository.create({ fullName: "Eligible Two", primaryEmail: "eligible2@example.com" });

    const list = await harness.notificationsService.createSuppressionList({ name: "Bounced" }, { userId: "system" });
    await harness.notificationsService.addSuppressionListMember(list.id, suppressed.id, { userId: "system" });

    const segment = await createStaticSegment(harness, token, [suppressed.id, eligible.id]);
    const campaign = await createCampaign(harness, token, { segmentId: segment.id });

    const preview = await request(harness.app)
      .post(`/api/admin/campaigns/${campaign.id}/preview`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(preview.body.data.eligibleRecipientCount).toBe(1);
    expect(preview.body.data.sampleRecipientIds).toEqual([eligible.id]);
  });

  it("sending a campaign creates campaign_recipients records for each eligible customer", async () => {
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const customerA = await harness.customersRepository.create({ fullName: "Recipient A", primaryEmail: "ra@example.com" });
    const customerB = await harness.customersRepository.create({ fullName: "Recipient B", primaryEmail: "rb@example.com" });

    const segment = await createStaticSegment(harness, token, [customerA.id, customerB.id]);
    const campaign = await createCampaign(harness, token, { segmentId: segment.id });

    const sendRes = await request(harness.app)
      .post(`/api/admin/campaigns/${campaign.id}/send`)
      .set("Authorization", `Bearer ${token}`);
    expect(sendRes.status).toBe(200);
    await harness.jobRunner.flush();

    const recipients = await request(harness.app)
      .get(`/api/admin/campaigns/${campaign.id}/recipients`)
      .set("Authorization", `Bearer ${token}`);

    expect(recipients.body.data).toHaveLength(2);
    expect(recipients.body.data.map((r: { customerId: string }) => r.customerId).sort()).toEqual(
      [customerA.id, customerB.id].sort(),
    );
  });

  it("a failed recipient send is logged with a sanitized error and does not stop the campaign", async () => {
    const { harness, token } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const customerA = await harness.customersRepository.create({ fullName: "Will Fail", primaryEmail: "fail@example.com" });
    const customerB = await harness.customersRepository.create({ fullName: "Will Succeed", primaryEmail: "succeed@example.com" });

    // A template that requires a variable never supplied at send time —
    // sendCampaign renders with an empty context, so this always fails
    // the render and exercises the per-recipient catch block.
    const template = await harness.notificationsService.createTemplate(
      { name: "Needs Var", channel: "email", body: "Hello {{firstName}}", variables: ["firstName"] },
      { userId: "system" },
    );

    const segment = await createStaticSegment(harness, token, [customerA.id, customerB.id]);
    const campaign = await createCampaign(harness, token, { segmentId: segment.id, messageTemplateId: template.id });

    await request(harness.app).post(`/api/admin/campaigns/${campaign.id}/send`).set("Authorization", `Bearer ${token}`);
    await harness.jobRunner.flush();

    const report = await request(harness.app)
      .get(`/api/admin/campaigns/${campaign.id}/report`)
      .set("Authorization", `Bearer ${token}`);

    expect(report.body.data.failed).toBe(2);
    expect(report.body.data.sent).toBe(0);

    const recipients = await request(harness.app)
      .get(`/api/admin/campaigns/${campaign.id}/recipients`)
      .set("Authorization", `Bearer ${token}`);
    for (const r of recipients.body.data) {
      expect(r.status).toBe("failed");
      expect(r.errorMessage).toBe("The notification could not be delivered. Please try again later.");
    }
  });

  it("a message template renders correctly when all declared variables are supplied", async () => {
    const { harness } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const template = await harness.notificationsService.createTemplate(
      { name: "Greeting", channel: "email", body: "Hello {{firstName}}, welcome!", variables: ["firstName"] },
      { userId: "system" },
    );

    const rendered = await harness.notificationsService.renderTemplateById(template.id, { firstName: "Amir" });
    expect(rendered).toBe("Hello Amir, welcome!");

    await expect(harness.notificationsService.renderTemplateById(template.id, {})).rejects.toMatchObject({
      statusCode: 422,
      code: "TEMPLATE_VARIABLES_MISSING",
    });
  });

  it("denies campaign:send to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["campaign:view", "campaign:create", "segment:view", "segment:create"]);
    const segment = await createStaticSegment(harness, token, []);
    const campaign = await createCampaign(harness, token, { segmentId: segment.id });

    const res = await request(harness.app)
      .post(`/api/admin/campaigns/${campaign.id}/send`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("denies segment:evaluate to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["segment:view", "segment:create"]);
    const segment = await createStaticSegment(harness, token, []);
    const res = await request(harness.app)
      .post(`/api/admin/segments/${segment.id}/evaluate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("sending a campaign writes a campaign.send audit log entry", async () => {
    const { harness, token, actor } = await buildAuthedHarness(ADMIN_PERMISSIONS);
    const customer = await harness.customersRepository.create({ fullName: "Audited", primaryEmail: "audited@example.com" });
    const segment = await createStaticSegment(harness, token, [customer.id]);
    const campaign = await createCampaign(harness, token, { segmentId: segment.id });

    await request(harness.app).post(`/api/admin/campaigns/${campaign.id}/send`).set("Authorization", `Bearer ${token}`);

    const logs = await harness.auditService.listAuditLogs(1, 50);
    const sendLog = logs.rows.find((l) => l.action === "campaign.send" && l.target_id === campaign.id);
    expect(sendLog).toBeDefined();
    expect(sendLog!.actor_id).toBe(actor.id);
  });
});
