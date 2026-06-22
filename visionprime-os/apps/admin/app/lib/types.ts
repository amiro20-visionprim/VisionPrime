/**
 * Frontend-facing mirrors of the backend's public response shapes —
 * see apps/api/src/modules/{module}/{module}.types.ts for the source
 * of truth.
 */
export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AdminUserWithRoles extends AdminUser {
  roleIds?: string[];
}

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  permissionKeys: string[];
}

export interface PermissionCatalogEntry {
  key: string;
  description: string;
}

export interface BusinessSettings {
  id: string;
  general: Record<string, unknown>;
  features: Record<string, unknown>;
  appearance: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  before: unknown;
  after: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ActivityLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  metadata: unknown;
  ip_address: string | null;
  created_at: string;
}

export interface SecurityEventRow {
  id: string;
  type: string;
  severity: string;
  user_id: string | null;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: unknown;
  created_at: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface WordPressConnection {
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
  created_at: string;
  updated_at: string;
}

export interface WordPressSyncLogRow {
  id: string;
  sync_job_id: string | null;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  created_at: string;
}
