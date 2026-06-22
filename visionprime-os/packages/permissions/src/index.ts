/**
 * Phase 03: system-defined RBAC permission catalog. Permissions are
 * colon-separated (`resource:action`), immutable via API, and seeded only
 * via the database migration (see
 * packages/database/migrations/0001_auth_rbac_settings_audit.sql).
 */

export const SYSTEM_PERMISSIONS = [
  "auth:login",
  "user:view",
  "user:create",
  "user:update",
  "user:delete",
  "role:view",
  "role:create",
  "role:update",
  "role:delete",
  "permission:view",
  "settings:view",
  "settings:manage",
  "audit:view",
  "security_event:view",

  // --- Phase 04: WordPress/WooCommerce connection management ---
  "wordpress:view",
  "wordpress:connect",
  "wordpress:update",
  "wordpress:test",
  "wordpress:webhook_register",
  "wordpress:sync_job:view",
  "wordpress:sync_log:view",

  // --- Phase 05: customer/product modules + WooCommerce customer/product sync ---
  "customer:view",
  "customer:create",
  "customer:update",
  "customer:delete",
  "customer:merge",
  "customer:note:create",
  "customer:tag:update",
  "product:view",
  "wordpress:sync_customer",
  "wordpress:sync_product",

  // --- Phase 06: WooCommerce order sync, order webhooks, customer purchase metrics ---
  "order:view",
  "order:sync",
  "wordpress:webhook:view",
] as const;

export type Permission = (typeof SYSTEM_PERMISSIONS)[number];

/**
 * Permissions a user must never lose on themselves via a role edit —
 * losing any of these would lock the acting user out of RBAC management.
 */
export const CRITICAL_PERMISSIONS: Permission[] = ["user:update", "role:update", "permission:view"];

export interface PermissionContext {
  userId: string;
  isSuperAdmin: boolean;
  permissions: Permission[];
}

/**
 * Server-side permission check. Frontend permission-based UI hiding is a
 * convenience only; this function is the actual enforcement point and
 * must be called on every guarded endpoint. Super admins implicitly hold
 * every permission.
 */
export function hasPermission(context: PermissionContext, required: Permission): boolean {
  return context.isSuperAdmin || context.permissions.includes(required);
}
