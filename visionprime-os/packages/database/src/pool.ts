import { Pool, PoolConfig } from "pg";
import { Db, QueryResult } from "./types";

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

/**
 * Wraps a `pg.Pool` as a `Db`, adding `withTransaction` (BEGIN/COMMIT,
 * ROLLBACK on throw, single connection for the duration of `fn`). Use this
 * instead of passing the raw `Pool` into `createApp` so financial modules
 * (wallet ledger) can rely on real atomicity.
 */
export function createDb(pool: Pool): Db {
  return {
    query: <T = unknown>(text: string, params?: unknown[]) =>
      pool.query(text, params) as unknown as Promise<QueryResult<T>>,
    async withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const tx: Db = {
        query: <T2 = unknown>(text: string, params?: unknown[]) =>
          client.query(text, params) as unknown as Promise<QueryResult<T2>>,
        withTransaction: (innerFn) => innerFn(tx),
      };
      try {
        await client.query("BEGIN");
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

export function describeConnection(config: DatabaseConnectionConfig): string {
  return `database pool configured for: ${maskUrl(config.url)}`;
}

function maskUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}
