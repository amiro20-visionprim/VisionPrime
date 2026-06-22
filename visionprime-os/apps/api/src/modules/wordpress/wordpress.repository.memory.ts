import { randomUUID } from "crypto";
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

export function createMemoryWordPressConnectionRepository(
  seed?: Partial<WordPressConnectionRow>,
): WordPressConnectionRepository {
  const row: WordPressConnectionRow = {
    id: seed?.id ?? randomUUID(),
    site_url: seed?.site_url ?? null,
    consumer_key_encrypted: seed?.consumer_key_encrypted ?? null,
    consumer_secret_encrypted: seed?.consumer_secret_encrypted ?? null,
    shared_secret_encrypted: seed?.shared_secret_encrypted ?? null,
    plugin_api_key_hash: seed?.plugin_api_key_hash ?? null,
    status: seed?.status ?? "disconnected",
    last_tested_at: seed?.last_tested_at ?? null,
    last_test_success: seed?.last_test_success ?? null,
    last_test_message: seed?.last_test_message ?? null,
    webhook_registration_status: seed?.webhook_registration_status ?? "not_registered",
    webhook_registered_at: seed?.webhook_registered_at ?? null,
    settings: seed?.settings ?? {},
    created_at: seed?.created_at ?? new Date().toISOString(),
    updated_at: seed?.updated_at ?? new Date().toISOString(),
    updated_by: seed?.updated_by ?? null,
  };

  return {
    async get(): Promise<WordPressConnectionRow> {
      return row;
    },

    async update(fields: ConnectionUpdateFields, updatedBy: string): Promise<WordPressConnectionRow> {
      Object.assign(row, fields);
      row.updated_at = new Date().toISOString();
      row.updated_by = updatedBy;
      return row;
    },

    async recordTestResult(fields: ConnectionTestResultFields): Promise<WordPressConnectionRow> {
      row.last_tested_at = fields.last_tested_at;
      row.last_test_success = fields.last_test_success;
      row.last_test_message = fields.last_test_message;
      row.status = fields.status;
      return row;
    },

    async recordWebhookRegistration(fields: ConnectionWebhookFields): Promise<WordPressConnectionRow> {
      row.webhook_registration_status = fields.webhook_registration_status;
      row.webhook_registered_at = fields.webhook_registered_at;
      return row;
    },
  };
}

export function createMemoryWordPressSyncJobRepository(seed: WordPressSyncJobRow[] = []): WordPressSyncJobRepository {
  const rows = [...seed];
  return {
    async list(page: number, pageSize: number): Promise<ListResult<WordPressSyncJobRow>> {
      const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const start = (page - 1) * pageSize;
      return { rows: sorted.slice(start, start + pageSize), totalItems: rows.length };
    },
  };
}

export function createMemoryWordPressSyncLogRepository(seed: WordPressSyncLogRow[] = []): WordPressSyncLogRepository {
  const rows = [...seed];
  return {
    async list(page: number, pageSize: number): Promise<ListResult<WordPressSyncLogRow>> {
      const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const start = (page - 1) * pageSize;
      return { rows: sorted.slice(start, start + pageSize), totalItems: rows.length };
    },
  };
}

export function createMemoryWordPressWebhookEventRepository(): WordPressWebhookEventRepository {
  const rows: WordPressWebhookEventRow[] = [];
  return {
    async insert(entry): Promise<WordPressWebhookEventRow> {
      const row: WordPressWebhookEventRow = {
        id: randomUUID(),
        event_type: entry.event_type,
        status: entry.status,
        detail: entry.detail,
        metadata: entry.metadata,
        created_at: new Date().toISOString(),
      };
      rows.push(row);
      return row;
    },
  };
}
