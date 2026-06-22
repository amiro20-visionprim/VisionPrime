import { Pool, PoolConfig } from "pg";

export interface DatabaseConnectionConfig {
  url: string;
}

/**
 * The only sanctioned way to obtain a Postgres connection pool — see
 * /docs/architecture.md (`database` package owns the ORM client).
 */
export function createPool(config: DatabaseConnectionConfig, options: PoolConfig = {}): Pool {
  return new Pool({ connectionString: config.url, ...options });
}

export function describeConnection(config: DatabaseConnectionConfig): string {
  return `database pool configured for: ${maskUrl(config.url)}`;
}

function maskUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}
