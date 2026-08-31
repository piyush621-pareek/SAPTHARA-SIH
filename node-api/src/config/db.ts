import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "./env";

/**
 * Singleton PostgreSQL connection pool (PostGIS-enabled cluster).
 * A single pool is shared across all repositories.
 */
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err: Error) => {
  // Errors on idle clients are surfaced here; do not crash the process.
  // eslint-disable-next-line no-console
  console.error("[pg] unexpected idle-client error:", err.message);
});

/**
 * Thin typed wrapper around pool.query so repositories stay terse.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}

/**
 * Runs a set of statements inside a single transaction.
 * Automatically COMMITs on success and ROLLBACKs on any thrown error.
 */
export async function withTransaction<T>(
  handler: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Verifies connectivity + PostGIS availability at boot, with a bounded retry
 * loop. A healthy `pg_isready` can still briefly refuse real connections while
 * the container re-applies init scripts, so we retry with linear backoff
 * instead of relying on a crash-and-restart to recover.
 */
export async function assertDbReady(
  retries = 10,
  delayMs = 2_000
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { rows } = await query<{ postgis_version: string }>(
        "SELECT PostGIS_Version() AS postgis_version"
      );
      // eslint-disable-next-line no-console
      console.log(`[pg] connected. PostGIS ${rows[0]?.postgis_version ?? "?"}`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === retries) {
        throw new Error(
          `[pg] not ready after ${retries} attempts: ${message}`
        );
      }
      // eslint-disable-next-line no-console
      console.warn(
        `[pg] not ready (attempt ${attempt}/${retries}): ${message} — retrying in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }
}
