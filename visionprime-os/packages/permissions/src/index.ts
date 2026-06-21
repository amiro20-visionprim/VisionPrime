/**
 * Placeholder RBAC scaffolding for Phase 01.
 *
 * Real module permissions (customers.view, wallet.credit, etc. — see
 * /docs/permissions.md) are added alongside their modules starting
 * Phase 02. This package only establishes the shapes and the
 * server-side enforcement entry point so later phases plug into a
 * single, consistent mechanism.
 */

export type Permission = string;

export type Role = "owner" | "manager" | "support" | "viewer";

export interface PermissionContext {
  userId: string;
  roles: Role[];
  permissions: Permission[];
}

/**
 * Server-side permission check. Frontend permission-based UI hiding is a
 * convenience only; this function (or its eventual real implementation)
 * is the actual enforcement point and must be called on every guarded
 * endpoint.
 */
export function hasPermission(context: PermissionContext, required: Permission): boolean {
  return context.permissions.includes(required);
}
