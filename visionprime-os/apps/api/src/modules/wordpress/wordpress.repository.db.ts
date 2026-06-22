import { Db } from "@visionprime/database";
import {
  ConnectionTestResultFields,
  ConnectionUpdateFields,
  ConnectionWebhookFields,
  ListResult,
  WordPressConnectionRepository,
  WordPressSyncJobRepository,
  WordPressSyncLogRepository,
  WordPressWebhookEventRepository,
} from "./wordpress.repository";
import { WordPressConnectionRow, WordPressSyncJobRow, WordPressSyncLogRow, WordPressWebhookEventRow } from "./wordpress.types";

/**
 * `wordpress_connections` is a singleton table (always exactly one row,
 * seeded by the migration), mirroring business_settings.
 */
export function createDbWordPressConnectionRepository(db: Db): WordPressConnectionRepository {
  return {
    async get(): Promise<WordPressConnectionRow> {
      const result = await db.query<WordPressConnectionRow>(`select * from wordpress_connections limit 1`);
      return result.rows[0];
    },

    async update(fields: ConnectionUpdateFields, updatedBy: string): Promise<WordPressConnectionRow> {
      const sets: string[] = [];
      const values: unknown[] = [];
      let i = 1;
      for (const [key, value] of Object.entries(fields)) {
        sets.push(`${key} = $${i}`);
        values.push(key === "settings" ? JSON.stringify(value) : value);
        i += 1;
      }
      sets.push(`updated_at = now()`, `updated_by = $${i}`);
      values.push(updatedBy);

      const result = await db.query<WordPressConnectionRow>(
        `update wordpress_connections set ${sets.join(", ")}
         where id = (select id from wordpress_connections limit 1)
         returning *`,
        values,
      );
      return result.rows[0];
    },

    async recordTestResult(fields: ConnectionTestResultFields): Promise<WordPressConnectionRow> {
      const result = await db.query<WordPressConnectionRow>(
        `update wordpress_connections
         set last_tested_at = $1, last_test_success = $2, last_test_message = $3, status = $4
         where id = (select id from wordpress_connections limit 1)
         returning *`,
        [fields.last_tested_at, fields.last_test_success, fields.last_test_message, fields.status],
      );
      return result.rows[0];
    },

    async recordWebhookRegistration(fields: ConnectionWebhookFields): Promise<WordPressConnectionRow> {
      const result = await db.query<WordPressConnectionRow>(
        `update wordpress_connections
         set webhook_registration_status = $1, webhook_registered_at = $2
         where id = (select id from wordpress_connections limit 1)
         returning *`,
        [fields.webhook_registration_status, fields.webhook_registered_at],
      );
      return result.rows[0];
    },
  };
}

export function createDbWordPressSyncJobRepository(db: Db): WordPressSyncJobRepository {
  return {
    async list(page: number, pageSize: number): Promise<ListResult<WordPressSyncJobRow>> {
      const offset = (page - 1) * pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<WordPressSyncJobRow>(
          `select * from wordpress_sync_jobs order by created_at desc limit $1 offset $2`,
          [pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*) from wordpress_sync_jobs`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0].count) };
    },
  };
}

export function createDbWordPressSyncLogRepository(db: Db): WordPressSyncLogRepository {
  return {
    async list(page: number, pageSize: number): Promise<ListResult<WordPressSyncLogRow>> {
      const offset = (page - 1) * pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<WordPressSyncLogRow>(
          `select * from wordpress_sync_logs order by created_at desc limit $1 offset $2`,
          [pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*) from wordpress_sync_logs`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0].count) };
    },
  };
}

export function createDbWordPressWebhookEventRepository(db: Db): WordPressWebhookEventRepository {
  return {
    async insert(entry): Promise<WordPressWebhookEventRow> {
      const result = await db.query<WordPressWebhookEventRow>(
        `insert into wordpress_webhook_events (event_type, status, detail, metadata)
         values ($1, $2, $3, $4)
         returning *`,
        [entry.event_type, entry.status, entry.detail, JSON.stringify(entry.metadata)],
      );
      return result.rows[0];
    },
  };
}
