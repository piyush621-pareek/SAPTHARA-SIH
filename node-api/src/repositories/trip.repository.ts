import { query } from "../config/db";
import { CreateTripBody } from "../schemas/trip.schema";

export interface TripRow {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  status: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TrackPoint {
  latitude: number;
  longitude: number;
  speed_kmph: number | null;
  timestamp: string;
}

/** Builds a WKT LINESTRING from [lng,lat] pairs, or null. */
function routeToWkt(route?: [number, number][] | null): string | null {
  if (!route || route.length < 2) return null;
  const coords = route.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
  return `LINESTRING(${coords})`;
}

const SELECT_COLS = `
  id, vehicle_id, driver_id, status,
  ST_Y(origin::geometry)      AS origin_lat,
  ST_X(origin::geometry)      AS origin_lng,
  ST_Y(destination::geometry) AS dest_lat,
  ST_X(destination::geometry) AS dest_lng,
  started_at, completed_at, created_at
`;

export async function createTrip(input: CreateTripBody): Promise<TripRow> {
  const wkt = routeToWkt(input.planned_route as [number, number][] | null);
  const { rows } = await query<TripRow>(
    `INSERT INTO trips
       (vehicle_id, driver_id, origin, destination, planned_route, status)
     VALUES
       ($1, $2,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
        ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
        CASE WHEN $7::text IS NULL THEN NULL
             ELSE ST_SetSRID(ST_GeomFromText($7), 4326) END,
        'planned')
     RETURNING ${SELECT_COLS}`,
    [
      input.vehicle_id,
      input.driver_id ?? null,
      input.origin.longitude,
      input.origin.latitude,
      input.destination.longitude,
      input.destination.latitude,
      wkt,
    ]
  );
  return rows[0];
}

export async function getTrip(id: string): Promise<TripRow | null> {
  const { rows } = await query<TripRow>(
    `SELECT ${SELECT_COLS} FROM trips WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listTrips(limit = 50, offset = 0): Promise<TripRow[]> {
  const { rows } = await query<TripRow>(
    `SELECT ${SELECT_COLS} FROM trips ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

/**
 * Updates a trip's status, stamping started_at / completed_at on the relevant
 * transitions. Returns the updated row, or null if the trip does not exist.
 */
export async function updateTripStatus(
  id: string,
  status: string
): Promise<TripRow | null> {
  const { rows } = await query<TripRow>(
    `UPDATE trips
        SET status = $2::trip_status,
            started_at = CASE
              WHEN $2 = 'in_transit' AND started_at IS NULL THEN now()
              ELSE started_at END,
            completed_at = CASE
              WHEN $2 IN ('completed', 'aborted') THEN now()
              ELSE completed_at END
      WHERE id = $1
      RETURNING ${SELECT_COLS}`,
    [id, status]
  );
  return rows[0] ?? null;
}

/**
 * Telemetry breadcrumb for a trip (ordered oldest→newest). Matches points
 * explicitly tagged with this trip_id OR — for edge apps that don't tag points —
 * the trip's vehicle within the trip's active time window.
 */
export async function getTripTrack(trip: {
  id: string;
  vehicle_id: string;
  started_at: string | null;
  completed_at: string | null;
}): Promise<TrackPoint[]> {
  const { rows } = await query<TrackPoint>(
    `SELECT
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        speed_kmph,
        "timestamp"
      FROM telemetry
     WHERE trip_id = $1
        OR (
          $2::timestamptz IS NOT NULL
          AND vehicle_id = $3
          AND "timestamp" >= $2::timestamptz
          AND "timestamp" <= COALESCE($4::timestamptz, now())
        )
     ORDER BY "timestamp" ASC`,
    [trip.id, trip.started_at, trip.vehicle_id, trip.completed_at]
  );
  return rows;
}
