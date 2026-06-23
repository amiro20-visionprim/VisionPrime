import { randomUUID } from "crypto";
import { SessionsRepository } from "./sessions.repository";
import { NewSessionRecord, SessionRow } from "./sessions.types";

export function createMemorySessionsRepository(): SessionsRepository {
  const rows: SessionRow[] = [];

  return {
    async create(record: NewSessionRecord): Promise<SessionRow> {
      const row: SessionRow = {
        id: randomUUID(),
        user_id: record.userId,
        refresh_token_hash: record.refreshTokenHash,
        user_agent: record.userAgent ?? null,
        ip_address: record.ipAddress ?? null,
        expires_at: record.expiresAt.toISOString(),
        revoked_at: null,
        created_at: new Date().toISOString(),
      };
      rows.push(row);
      return row;
    },

    async findByRefreshTokenHash(hash: string): Promise<SessionRow | null> {
      return rows.find((r) => r.refresh_token_hash === hash) ?? null;
    },

    async revoke(id: string): Promise<void> {
      const row = rows.find((r) => r.id === id);
      if (row && !row.revoked_at) {
        row.revoked_at = new Date().toISOString();
      }
    },
  };
}
