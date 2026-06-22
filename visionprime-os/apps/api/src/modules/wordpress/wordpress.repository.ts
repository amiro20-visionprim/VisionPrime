import { WordPressConnectionRow, WordPressSyncJobRow, WordPressSyncLogRow, WordPressWebhookEventRow } from "./wordpress.types";

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
}

export interface WordPressSyncLogRepository {
  list(page: number, pageSize: number): Promise<ListResult<WordPressSyncLogRow>>;
}

export interface WordPressWebhookEventRepository {
  insert(entry: Pick<WordPressWebhookEventRow, "event_type" | "status" | "detail" | "metadata">): Promise<WordPressWebhookEventRow>;
}
