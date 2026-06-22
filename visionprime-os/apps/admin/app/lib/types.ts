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
  purchase_count: number;
  total_spent: string;
  average_order_value: string;
  last_purchase_at: string | null;
  lifetime_value: string;
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

export interface Customer360Order {
  id: string;
  woocommerce_order_id: string;
  status: string;
  currency: string | null;
  total: string;
  ordered_at: string | null;
  created_at: string;
}

export interface Customer360 {
  customer: Customer;
  notes: CustomerNote[];
  tags: CustomerTag[];
  identities: CustomerIdentity[];
  events: CustomerEvent[];
  orders: Customer360Order[];
}

export interface Order {
  id: string;
  customer_id: string;
  woocommerce_order_id: string;
  status: string;
  currency: string | null;
  total: string;
  ordered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  woocommerce_product_id: string | null;
  name: string;
  quantity: number;
  price: string;
  total: string;
  created_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  events: OrderEvent[];
}

export interface WordPressWebhookEventRow {
  id: string;
  event_type: string;
  status: string;
  detail: string | null;
  delivery_id: string | null;
  created_at: string;
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

export interface Wallet {
  id: string;
  customerId: string;
  currency: string;
  status: string;
  availableBalanceCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletLedgerEntry {
  id: string;
  wallet_id: string;
  customer_id: string;
  type: string;
  direction: "credit" | "debit";
  amount_cents: number;
  currency: string;
  reason: string;
  internal_note: string | null;
  reference_type: string | null;
  reference_id: string | null;
  idempotency_key: string | null;
  reversed_entry_id: string | null;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
}

export interface WalletLiabilityReport {
  totalLiabilityCents: number;
  walletCount: number;
  currency: string;
}
