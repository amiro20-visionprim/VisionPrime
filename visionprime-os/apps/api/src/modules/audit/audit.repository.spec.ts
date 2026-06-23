import { createMemoryAuditLogRepository } from "./audit.repository.memory";
import { AuditLogRepository } from "./audit.repository";

describe("Audit log repository contract", () => {
  it("is append-only: only insert and list are exposed, no update/delete", () => {
    const repository: AuditLogRepository = createMemoryAuditLogRepository();
    const methodNames = Object.keys(repository);

    expect(methodNames.sort()).toEqual(["insert", "list"]);
    expect((repository as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((repository as unknown as Record<string, unknown>).delete).toBeUndefined();
  });

  it("inserted entries are retrievable via list in recency order", async () => {
    const repository = createMemoryAuditLogRepository();
    await repository.insert({ actorId: "actor-1", action: "user.create", targetType: "user", targetId: "u1" });
    await repository.insert({ actorId: "actor-1", action: "user.update", targetType: "user", targetId: "u1" });

    const page = await repository.list({ page: 1, pageSize: 20 });
    expect(page.totalItems).toBe(2);
    expect(page.rows[0].action).toBe("user.update");
    expect(page.rows[1].action).toBe("user.create");
  });
});
