import {
  WordPressConnectionRow,
  WordPressEntityMappingRow,
  WordPressSyncJobRow,
  WordPressSyncLogRow,
  WordPressWebhookEventRow,
} from "./wordpress.types";

export interface ConnectionUpdateFields {
  site_url?: string | null;
  consumer_key_encrypted?: string | null;
  consumer_secret_encrypted?: string | null;
  shared_secret_encrypted?: string | null;
  plugin_api_key_hash?: string | null;
  status?: WordPressConnectionRow["status"];
  settings?: Record<string, unknown>;
}

export interface ConnectionTestResultFields {
  last_tested_at: string;
  last_test_success: boolean;
  last_test_message: string | null;
  status: WordPressConnectionRow["status"];
}

export interface ConnectionWebhookFields {
  webhook_registration_status: WordPressConnectionRow["webhook_registration_status"];
  webhook_registered_at: string | null;
}

export interface WordPressConnectionRepository {
  get(): Promise<WordPressConnectionRow>;
  update(fields: ConnectionUpdateFields, updatedBy: string): Promise<WordPressConnectionRow>;
  recordTestResult(fields: ConnectionTestResultFields): Promise<WordPressConnectionRow>;
  recordWebhookRegistration(fields: ConnectionWebhookFields): Promise<WordPressConnectionRow>;
}

export interface ListResult<T> {
  rows: T[];
  totalItems: number;
}

export interface WordPressSyncJobRepository {
  list(page: number, pageSize: number): Promise<ListResult<WordPressSyncJobRow>>;
  create(jobType: string): Promise<WordPressSyncJobRow>;
  updateStatus(
    id: string,
    fields: { status: WordPressSyncJobRow["status"]; finishedAt?: string | null; metadata?: Record<string, unknown> },
  ): Promise<WordPressSyncJobRow>;
}

export interface WordPressSyncLogRepository {
  list(page: number, pageSize: number): Promise<ListResult<WordPressSyncLogRow>>;
  insert(entry: { sync_job_id: string | null; level: WordPressSyncLogRow["level"]; message: string; metadata?: Record<string, unknown> }): Promise<WordPressSyncLogRow>;
}

export interface WordPressWebhookEventRepository {
  insert(
    entry: Pick<WordPressWebhookEventRow, "event_type" | "status" | "detail" | "metadata"> & {
      delivery_id?: string | null;
    },
  ): Promise<WordPressWebhookEventRow>;
  /** Used to detect and ignore duplicate webhook deliveries. */
  findByDeliveryId(deliveryId: string): Promise<WordPressWebhookEventRow | null>;
  list(page: number, pageSize: number): Promise<ListResult<WordPressWebhookEventRow>>;
  updateStatus(id: string, status: string, detail?: string | null): Promise<WordPressWebhookEventRow>;
}

export interface WordPressEntityMappingRepository {
  findByRemoteId(entityType: string, remoteId: string): Promise<WordPressEntityMappingRow | null>;
  findByLocalId(entityType: string, localId: string): Promise<WordPressEntityMappingRow | null>;
  /** Idempotent insert-or-update keyed on (entity_type, remote_id). */
  upsert(entityType: string, localId: string, remoteId: string, metadata?: Record<string, unknown>): Promise<WordPressEntityMappingRow>;
}
