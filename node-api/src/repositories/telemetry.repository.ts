import { PoolClient } from "pg";
import { query, withTransaction } from "../config/db";
import { TelemetryPoint } from "../schemas/telemetry.schema";

/** Row shape returned after a successful (non-conflicting) insert. */
export interface InsertedTelemetryRow {
  id: string;
  vehicle_id: string;
  timestamp: string;
}

// Columns written per telemetry row. `location` is ONE column but is built
// from two placeholders (lng, lat), so each tuple carries 10 placeholders.
const TELEMETRY_COLUMNS = [
  "vehicle_id",
  "trip_id",
  '"timestamp"',
  "location",
  "speed_kmph",
  "heading_deg",
  "altitude_m",
  "battery_pct",
  "source",
];

const PLACEHOLDERS_PER_ROW = 10;

/**
 * Bulk-insert telemetry with native DB deduplication.
 *
 * A single multi-row INSERT ... ON CONFLICT (vehicle_id, timestamp) DO NOTHING.
 * Points already present (re-uploaded from an offline edge buffer) are silently
 * skipped by the compound unique constraint — no application-side dedup pass.
 * RETURNING emits only genuinely-new rows, so its length == inserted count.
 */
export async function bulkInsertTelemetry(
  points: TelemetryPoint[]
): Promise<InsertedTelemetryRow[]> {
  if (points.length === 0) return [];

  return withTransaction(async (client: PoolClient) => {
    const values: unknown[] = [];
    const tuples: string[] = [];

    points.forEach((p, i) => {
      const b = i * PLACEHOLDERS_PER_ROW;
      tuples.push(
        `($${b + 1}, $${b + 2}, $${b + 3}, ` +
          `ST_SetSRID(ST_MakePoint($${b + 4}, $${b + 5}), 4326)::geography, ` +
          `$${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10})`
      );
      values.push(
        p.vehicle_id,
        p.trip_id ?? null,
        p.timestamp,
        p.longitude, // ST_MakePoint(x = lng, y = lat)
        p.latitude,
        p.speed_kmph ?? null,
        p.heading_deg ?? null,
        p.altitude_m ?? null,
        p.battery_pct ?? null,
        p.source
      );
    });

    const sql = `
      INSERT INTO telemetry (${TELEMETRY_COLUMNS.join(", ")})
      VALUES ${tuples.join(",\n             ")}
      ON CONFLICT (vehicle_id, "timestamp") DO NOTHING
      RETURNING id, vehicle_id, "timestamp"
    `;

    const { rows } = await client.query<InsertedTelemetryRow>(sql, values as never[]);

    // Keep each vehicle's denormalized last-position fresh from the newest point.
    await refreshVehicleLastLocation(client, points);

    return rows;
  });
}

/**
 * Updates each vehicle's last_location/last_seen_at to its most recent point in
 * this batch (max timestamp wins). Runs inside the caller's transaction.
 */
async function refreshVehicleLastLocation(
  client: PoolClient,
  points: TelemetryPoint[]
): Promise<void> {
  const latestByVehicle = new Map<string, TelemetryPoint>();
  for (const p of points) {
    const prev = latestByVehicle.get(p.vehicle_id);
    if (!prev || new Date(p.timestamp) > new Date(prev.timestamp)) {
      latestByVehicle.set(p.vehicle_id, p);
    }
  }

  for (const p of latestByVehicle.values()) {
    await client.query(
      `UPDATE vehicles
          SET last_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              last_seen_at  = $3,
              status        = 'active'
        WHERE id = $4
          AND (last_seen_at IS NULL OR last_seen_at < $3)`,
      [p.longitude, p.latitude, p.timestamp, p.vehicle_id]
    );
  }
}

/** Inserts a single relayed telemetry point (BLE mesh). Returns true if new. */
export async function insertRelayPoint(p: TelemetryPoint): Promise<boolean> {
  const { rowCount } = await query(
    `INSERT INTO telemetry
       (vehicle_id, trip_id, "timestamp", location, speed_kmph, source)
     VALUES
       ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7)
     ON CONFLICT (vehicle_id, "timestamp") DO NOTHING`,
    [
      p.vehicle_id,
      p.trip_id ?? null,
      p.timestamp,
      p.longitude,
      p.latitude,
      p.speed_kmph ?? null,
      p.source,
    ]
  );
  return (rowCount ?? 0) > 0;
}
