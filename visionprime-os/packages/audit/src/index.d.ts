/**
 * Placeholder audit log writer for Phase 01. The real implementation
 * (persisting to an append-only audit table — see
 * /docs/database-conventions.md) lands once the database package has a
 * schema, starting Phase 02. Sensitive-action call sites in later
 * phases should depend on this interface so swapping the implementation
 * never requires touching call sites.
 */
export interface AuditEvent {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
}
export interface AuditLogger {
    record(event: AuditEvent): Promise<void>;
}
export declare function createNoopAuditLogger(): AuditLogger;
