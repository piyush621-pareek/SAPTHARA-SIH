import fs from "fs";
import path from "path";
import { pool } from "./config/db";

// migrations/ sits next to src (dev) and next to dist (prod); both resolve via ..
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

/**
 * Minimal forward-only migration runner. Each .sql file in migrations/ runs
 * once, inside its own transaction, tracked in schema_migrations. init-db.sql
 * remains the fresh-install baseline; these are incremental changes on top.
 */
export async function runMigrations(): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    // eslint-disable-next-line no-console
    console.log("[migrate] no migrations directory, skipping");
    return;
  }

  const applied = new Set(
    (await pool.query<{ id: string }>("SELECT id FROM schema_migrations")).rows.map(
      (r) => r.id
    )
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      count++;
      // eslint-disable-next-line no-console
      console.log(`[migrate] applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(
        `[migrate] failed on ${file}: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      client.release();
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[migrate] up to date (${count} applied this run)`);
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    });
}
