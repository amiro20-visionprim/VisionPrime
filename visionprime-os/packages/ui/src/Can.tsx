import React from "react";

export interface CanProps {
  /** Permission string in `module.action` form, e.g. "customers.delete". */
  permission: string;
  /** Permissions the current user holds. Real auth wiring lands in Phase 03. */
  userPermissions?: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Placeholder permission gate for UI actions — see /docs/permissions.md.
 * Until Phase 03 wires real auth context, `userPermissions` defaults to
 * "allow everything" so placeholder pages render normally.
 */
export function Can({ permission, userPermissions, children, fallback = null }: CanProps) {
  if (!userPermissions) return <>{children}</>;
  return userPermissions.includes(permission) ? <>{children}</> : <>{fallback}</>;
}
