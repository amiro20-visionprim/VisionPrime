import { Db } from "@visionprime/database";
import { SessionsRepository } from "./sessions.repository";
import { NewSessionRecord, SessionRow } from "./sessions.types";

export function createDbSessionsRepository(db: Db): SessionsRepository {
  return {
    async create(record: NewSessionRecord): Promise<SessionRow> {
      const result = await db.query<SessionRow>(
        `insert into sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
         values ($1, $2, $3, $4, $5)
         returning *`,
        [
          record.userId,
          record.refreshTokenHash,
          record.userAgent ?? null,
          record.ipAddress ?? null,
          record.expiresAt.toISOString(),
        ],
      );
      return result.rows[0];
    },

    async findByRefreshTokenHash(hash: string): Promise<SessionRow | null> {
      const result = await db.query<SessionRow>(`select * from sessions where refresh_token_hash = $1`, [hash]);
      return result.rows[0] ?? null;
    },

    async revoke(id: string): Promise<void> {
      await db.query(`update sessions set revoked_at = now() where id = $1 and revoked_at is null`, [id]);
    },
  };
}
