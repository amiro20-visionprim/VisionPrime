import { randomUUID } from "crypto";
import {
  ConnectionTestResultFields,
  ConnectionUpdateFields,
  ConnectionWebhookFields,
  ListResult,
  WordPressConnectionRepository,
  WordPressEntityMappingRepository,
  WordPressSyncJobRepository,
  WordPressSyncLogRepository,
  WordPressWebhookEventRepository,
} from "./wordpress.repository";
import {
  WordPressConnectionRow,
  WordPressEntityMappingRow,
  WordPressSyncJobRow,
  WordPressSyncLogRow,
  WordPressWebhookEventRow,
} from "./wordpress.types";

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

    async create(jobType: string): Promise<WordPressSyncJobRow> {
      const now = new Date().toISOString();
      const row: WordPressSyncJobRow = {
        id: randomUUID(),
        job_type: jobType,
        status: "running",
        started_at: now,
        finished_at: null,
        metadata: {},
        created_at: now,
        updated_at: now,
      };
      rows.push(row);
      return row;
    },

    async updateStatus(id, fields): Promise<WordPressSyncJobRow> {
      const row = rows.find((r) => r.id === id);
      if (!row) {
        throw new Error("Sync job not found");
      }
      row.status = fields.status;
      if (fields.finishedAt !== undefined) row.finished_at = fields.finishedAt;
      if (fields.metadata !== undefined) row.metadata = fields.metadata;
      row.updated_at = new Date().toISOString();
      return row;
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

    async insert(entry): Promise<WordPressSyncLogRow> {
      const row: WordPressSyncLogRow = {
        id: randomUUID(),
        sync_job_id: entry.sync_job_id,
        level: entry.level,
        message: entry.message,
        metadata: entry.metadata ?? {},
        created_at: new Date().toISOString(),
      };
      rows.push(row);
      return row;
    },
  };
}

export function createMemoryWordPressEntityMappingRepository(): WordPressEntityMappingRepository {
  const rows: WordPressEntityMappingRow[] = [];
  return {
    async findByRemoteId(entityType, remoteId): Promise<WordPressEntityMappingRow | null> {
      return rows.find((r) => r.entity_type === entityType && r.remote_id === remoteId) ?? null;
    },

    async findByLocalId(entityType, localId): Promise<WordPressEntityMappingRow | null> {
      return rows.find((r) => r.entity_type === entityType && r.local_id === localId) ?? null;
    },

    async upsert(entityType, localId, remoteId, metadata = {}): Promise<WordPressEntityMappingRow> {
      const existing = rows.find((r) => r.entity_type === entityType && r.remote_id === remoteId);
      const now = new Date().toISOString();
      if (existing) {
        existing.local_id = localId;
        existing.metadata = metadata;
        existing.updated_at = now;
        return existing;
      }
      const row: WordPressEntityMappingRow = {
        id: randomUUID(),
        entity_type: entityType,
        local_id: localId,
        remote_id: remoteId,
        metadata,
        created_at: now,
        updated_at: now,
      };
      rows.push(row);
      return row;
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
