import request from "supertest";
import { createLogger } from "@visionprime/logger";
import { Db } from "@visionprime/database";
import { createApp } from "./app";

describe("API foundation endpoints", () => {
  const fakeDb: Db = {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };

  const app = createApp(createLogger("test", "error"), {
    db: fakeDb,
    jwt: {
      accessSecret: "test-access-secret-0123456789",
      refreshSecret: "test-refresh-secret-0123456789",
      accessTtlMinutes: 15,
      refreshTtlDays: 7,
    },
    integrationEncryptionKey: "test-integration-encryption-key-32chars",
  });

  it("GET /api/health returns a standard success envelope", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.meta).toEqual({});
  });

  it("GET /api/version returns a standard success envelope", async () => {
    const res = await request(app).get("/api/version");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("@visionprime/api");
    expect(res.body.data.phase).toBe("phase-01-foundation");
  });

  it("GET /api/does-not-exist returns a standard 404 error envelope", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
