import { randomBytes, scryptSync } from "crypto";
import { Pool } from "pg";

/**
 * Creates the first Super Admin user from env-provided credentials.
 * Never run automatically — this is an explicit, manual operator step
 * (`npm run seed --workspace=packages/database`) so no default
 * credentials are ever baked into the system.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const name = process.env.SEED_SUPER_ADMIN_NAME || "Super Admin";

  if (!databaseUrl || !email || !password) {
    console.error("DATABASE_URL, SEED_SUPER_ADMIN_EMAIL, and SEED_SUPER_ADMIN_PASSWORD are required.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const existing = await pool.query("select id from users where email = $1", [email]);
    if (existing.rows.length > 0) {
      console.log(`User ${email} already exists — skipping seed.`);
      return;
    }

    const passwordHash = hashPassword(password);
    const userResult = await pool.query(
      `insert into users (email, password_hash, full_name, is_active, is_super_admin)
       values ($1, $2, $3, true, true) returning id`,
      [email, passwordHash, name],
    );
    const userId = userResult.rows[0].id;

    const roleResult = await pool.query("select id from roles where name = 'Super Admin'");
    if (roleResult.rows[0]) {
      await pool.query("insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing", [
        userId,
        roleResult.rows[0].id,
      ]);
    }

    console.log(`Seeded Super Admin user: ${email}`);
  } finally {
    await pool.end();
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
