import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

/**
 * Applies every `.sql` file in `migrations/` not yet recorded in
 * `schema_migrations`, in filename order. Migrations are idempotent
 * (`if not exists` / `on conflict do nothing`) but tracked anyway so the
 * runner doesn't re-execute large statements unnecessarily.
 */
export async function runMigrations(pool: Pool): Promise<string[]> {
  await ensureMigrationsTable(pool);

  const applied = new Set(
    (await pool.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await pool.query("begin");
    try {
      await pool.query(sql);
      await pool.query("insert into schema_migrations (name) values ($1)", [file]);
      await pool.query("commit");
      ran.push(file);
    } catch (err) {
      await pool.query("rollback");
      throw err;
    }
  }

  return ran;
}
