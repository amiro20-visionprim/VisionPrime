/**
 * Placeholder for Phase 01. No schema/migrations are introduced here —
 * those land in Phase 02+ alongside each module, per
 * /docs/database-conventions.md (UUID ids, append-only ledgers, etc.).
 *
 * This package will own the ORM client + migration runner once the
 * first real schema (Customer 360, Phase 02) is introduced.
 */
export interface DatabaseConnectionConfig {
  url: string;
}

export function describeConnection(config: DatabaseConnectionConfig): string {
  return `database package placeholder — would connect using: ${maskUrl(config.url)}`;
}

function maskUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}
