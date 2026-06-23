import request from "supertest";
import { buildTestApp } from "../../test-utils/build-test-app";
import { buildCustomerRow, buildRoleRow, buildUserRow } from "../../test-utils/fixtures";

async function loginAs(app: ReturnType<typeof buildTestApp>["app"], email: string, password: string) {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  return res.body.data.accessToken as string;
}

const ALL_CUSTOMER_PERMISSIONS = [
  "customer:view",
  "customer:create",
  "customer:update",
  "customer:delete",
  "customer:merge",
  "customer:note:create",
  "customer:tag:update",
];

describe("Customers controller", () => {
  async function buildAuthedHarness(permissions: string[], options?: Parameters<typeof buildTestApp>[0]) {
    const role = buildRoleRow({ name: "Customer Manager" });
    const actor = buildUserRow({ email: "cust@example.com" });
    const harness = buildTestApp({ ...options, users: [actor, ...(options?.users ?? [])], roles: [role] });

    await harness.rolesRepository.setPermissions(role.id, permissions);
    await harness.usersRepository.setRoles(actor.id, [role.id]);

    const token = await loginAs(harness.app, "cust@example.com", "correct-password");
    return { harness, token, actor };
  }

  it("creates a customer manually", async () => {
    const { harness, token } = await buildAuthedHarness(ALL_CUSTOMER_PERMISSIONS);

    const res = await request(harness.app)
      .post("/api/admin/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Jane Doe", primaryEmail: "jane@example.com", primaryMobile: "+15550001" });

    expect(res.status).toBe(201);
    expect(res.body.data.full_name).toBe("Jane Doe");
    expect(res.body.data.deleted_at).toBeNull();
  });

  it("does not create a duplicate customer when mobile/email matches", async () => {
    const existing = buildCustomerRow({ primary_email: "dup@example.com", primary_mobile: "+15550002" });
    const { harness, token } = await buildAuthedHarness(ALL_CUSTOMER_PERMISSIONS, { customers: [existing] });

    const res = await request(harness.app)
      .post("/api/admin/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Duplicate Person", primaryEmail: "dup@example.com" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");

    const list = await request(harness.app)
      .get("/api/admin/customers")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.meta.totalItems).toBe(1);
  });

  it("merges customers, preserving notes/tags/identities/events on the survivor", async () => {
    const survivor = buildCustomerRow({ full_name: "Survivor" });
    const merged = buildCustomerRow({ full_name: "Merged Away", primary_email: "merged@example.com" });
    const { harness, token } = await buildAuthedHarness(ALL_CUSTOMER_PERMISSIONS, { customers: [survivor, merged] });

    await harness.customersRepository.addNote(merged.id, "a note", null);
    await harness.customersRepository.addTag(merged.id, "vip");
    await harness.customersRepository.upsertIdentity(merged.id, "email", "alt@example.com");
    await harness.customersRepository.recordEvent(merged.id, "order.placed", {});

    const res = await request(harness.app)
      .post("/api/admin/customers/merge")
      .set("Authorization", `Bearer ${token}`)
      .send({ survivorCustomerId: survivor.id, mergedCustomerId: merged.id });

    expect(res.status).toBe(200);

    const notes = await harness.customersRepository.listNotes(survivor.id);
    const tags = await harness.customersRepository.listTags(survivor.id);
    const identities = await harness.customersRepository.listIdentities(survivor.id);
    const events = await harness.customersRepository.listEvents(survivor.id);
    expect(notes).toHaveLength(1);
    expect(tags.map((t) => t.tag)).toContain("vip");
    expect(identities).toHaveLength(1);
    expect(events).toHaveLength(1);

    const mergedAfter = await harness.customersRepository.findById(merged.id);
    expect(mergedAfter).toBeNull();
  });

  it("denies customer:create to a caller lacking the permission", async () => {
    const { harness, token } = await buildAuthedHarness(["customer:view"]);

    const res = await request(harness.app)
      .post("/api/admin/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Nope" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PERMISSION_DENIED");
  });
});
