import { Pool } from "pg";
import { runMigrations } from "./migrate";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required to run migrations.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const ran = await runMigrations(pool);
    if (ran.length === 0) {
      console.log("No pending migrations.");
    } else {
      console.log(`Applied migrations: ${ran.join(", ")}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
