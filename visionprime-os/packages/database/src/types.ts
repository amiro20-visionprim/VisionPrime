/**
 * Minimal query surface used by repositories. Production code is backed
 * by a real `pg.Pool`; tests inject an in-memory fake implementing the
 * same repository interfaces (see each module's `*.repository.ts`)
 * rather than emulating SQL — see /docs/phase-03-auth-rbac-settings-audit.md.
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Db {
  query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}
