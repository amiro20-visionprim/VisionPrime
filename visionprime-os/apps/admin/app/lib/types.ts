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

export interface WordPressSyncJobRowWithMetadata extends WordPressSyncJobRow {
  metadata?: { created: number; updated: number; failed: number; total: number } | null;
}

export interface Customer {
  id: string;
  full_name: string;
  primary_email: string | null;
  primary_mobile: string | null;
  wordpress_user_id: string | null;
  woocommerce_customer_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  author_id: string | null;
  note: string;
  created_at: string;
}

export interface CustomerTag {
  id: string;
  customer_id: string;
  tag: string;
  created_at: string;
}

export interface CustomerIdentity {
  id: string;
  customer_id: string;
  identity_type: string;
  identity_value: string;
  created_at: string;
}

export interface CustomerEvent {
  id: string;
  customer_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Customer360 {
  customer: Customer;
  notes: CustomerNote[];
  tags: CustomerTag[];
  identities: CustomerIdentity[];
  events: CustomerEvent[];
}

export interface Product {
  id: string;
  woocommerce_product_id: string;
  sku: string | null;
  name: string;
  status: string;
  price: string | null;
  category_woocommerce_ids: string[];
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  woocommerce_category_id: string;
  parent_woocommerce_category_id: string | null;
  created_at: string;
  updated_at: string;
}
