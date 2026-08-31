import { query } from "../config/db";

export interface FleetVehicleRow {
  id: string;
  registration: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  last_seen_at: string | null;
}

/**
 * Lists vehicles with their denormalized last-known position for the command
 * dashboard's initial fleet render (before live `fleet:update` events arrive).
 */
export async function listFleet(limit = 200, offset = 0): Promise<FleetVehicleRow[]> {
  const { rows } = await query<FleetVehicleRow>(
    `SELECT
        id,
        registration,
        status,
        ST_Y(last_location::geometry) AS latitude,
        ST_X(last_location::geometry) AS longitude,
        last_seen_at
      FROM vehicles
     ORDER BY registration ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}
