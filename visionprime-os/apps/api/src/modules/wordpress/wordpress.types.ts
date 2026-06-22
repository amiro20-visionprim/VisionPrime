export interface WordPressConnectionRow {
  id: string;
  site_url: string | null;
  consumer_key_encrypted: string | null;
  consumer_secret_encrypted: string | null;
  shared_secret_encrypted: string | null;
  plugin_api_key_hash: string | null;
  status: "disconnected" | "connected" | "error";
  last_tested_at: string | null;
  last_test_success: boolean | null;
  last_test_message: string | null;
  webhook_registration_status: "not_registered" | "registered" | "failed";
  webhook_registered_at: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Public shape returned by the API — secrets are never included, only
 * presence flags and masked previews. See docs/phase-04-wordpress-connection.md.
 */
export interface PublicWordPressConnection {
  id: string;
  siteUrl: string | null;
  hasConsumerKey: boolean;
  hasConsumerSecret: boolean;
  hasSharedSecret: boolean;
  hasPluginApiKey: boolean;
  status: "disconnected" | "connected" | "error";
  lastTestedAt: string | null;
  lastTestSuccess: boolean | null;
  lastTestMessage: string | null;
  webhookRegistrationStatus: "not_registered" | "registered" | "failed";
  webhookRegisteredAt: string | null;
  settings: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string | null;
}

export interface WordPressSyncJobRow {
  id: string;
  job_type: string;
  status: "queued" | "running" | "succeeded" | "failed";
  started_at: string | null;
  finished_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WordPressSyncLogRow {
  id: string;
  sync_job_id: string | null;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WordPressWebhookEventRow {
  id: string;
  event_type: string;
  status: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WordPressEntityMappingRow {
  id: string;
  entity_type: string;
  local_id: string;
  remote_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SyncCounts {
  created: number;
  updated: number;
  failed: number;
  total: number;
}

export function toPublicConnection(row: WordPressConnectionRow): PublicWordPressConnection {
  return {
    id: row.id,
    siteUrl: row.site_url,
    hasConsumerKey: Boolean(row.consumer_key_encrypted),
    hasConsumerSecret: Boolean(row.consumer_secret_encrypted),
    hasSharedSecret: Boolean(row.shared_secret_encrypted),
    hasPluginApiKey: Boolean(row.plugin_api_key_hash),
    status: row.status,
    lastTestedAt: row.last_tested_at,
    lastTestSuccess: row.last_test_success,
    lastTestMessage: row.last_test_message,
    webhookRegistrationStatus: row.webhook_registration_status,
    webhookRegisteredAt: row.webhook_registered_at,
    settings: row.settings,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
