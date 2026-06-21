"use strict";
/**
 * Placeholder RBAC scaffolding for Phase 01.
 *
 * Real module permissions (customers.view, wallet.credit, etc. — see
 * /docs/permissions.md) are added alongside their modules starting
 * Phase 02. This package only establishes the shapes and the
 * server-side enforcement entry point so later phases plug into a
 * single, consistent mechanism.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPermission = hasPermission;
/**
 * Server-side permission check. Frontend permission-based UI hiding is a
 * convenience only; this function (or its eventual real implementation)
 * is the actual enforcement point and must be called on every guarded
 * endpoint.
 */
function hasPermission(context, required) {
    return context.permissions.includes(required);
}
