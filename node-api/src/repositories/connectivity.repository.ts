import { query } from "../config/db";

export interface DeliveryRow {
  id: string;
  registration: string;
  status: string;
  last_seen_at: string | null;
  latitude: number | null;
  longitude: number | null;
  age_sec: number | null;
  in_hazard: boolean;
  nearest_hazard: string | null;
  nearest_hazard_km: number | null;
}

/**
 * Active vehicles with the data needed to derive a delivery status: telemetry
 * staleness (age), whether they are inside a hazard polygon, and the distance
 * to the nearest active hazard. Drives the delayed-/at-risk-delivery alerts.
 */
export async function getActiveDeliveries(): Promise<DeliveryRow[]> {
  const { rows } = await query<DeliveryRow>(
    `SELECT
        v.id,
        v.registration,
        v.status,
        v.last_seen_at,
        ST_Y(v.last_location::geometry) AS latitude,
        ST_X(v.last_location::geometry) AS longitude,
        EXTRACT(EPOCH FROM (now() - v.last_seen_at)) AS age_sec,
        EXISTS (
          SELECT 1 FROM hazards h
           WHERE h.active AND (h.expires_at IS NULL OR h.expires_at > now())
             AND ST_Contains(h.area, v.last_location::geometry)
        ) AS in_hazard,
        (SELECT h.label FROM hazards h
           WHERE h.active AND (h.expires_at IS NULL OR h.expires_at > now())
           ORDER BY ST_Distance(v.last_location, h.area) LIMIT 1) AS nearest_hazard,
        (SELECT ST_Distance(v.last_location, h.area) / 1000.0 FROM hazards h
           WHERE h.active AND (h.expires_at IS NULL OR h.expires_at > now())
           ORDER BY ST_Distance(v.last_location, h.area) LIMIT 1) AS nearest_hazard_km
      FROM vehicles v
     WHERE v.status = 'active' AND v.last_location IS NOT NULL`
  );
  return rows.map((r) => ({
    ...r,
    age_sec: r.age_sec === null ? null : Number(r.age_sec),
    nearest_hazard_km:
      r.nearest_hazard_km === null ? null : Number(r.nearest_hazard_km),
  }));
}

/**
 * Live traffic near a point from recent telemetry: how many distinct vehicles
 * reported within `radiusM` in the last `windowMin` minutes, and their average
 * speed. Drives the data-driven congestion-risk score.
 */
export async function getTrafficNear(
  lat: number,
  lng: number,
  radiusM = 8000,
  windowMin = 15
): Promise<{ vehicles: number; avg_speed: number | null }> {
  const { rows } = await query<{ vehicles: string; avg_speed: number | null }>(
    `SELECT COUNT(DISTINCT vehicle_id) AS vehicles, AVG(speed_kmph) AS avg_speed
       FROM telemetry
      WHERE "timestamp" > now() - ($4 || ' minutes')::interval
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
    [lng, lat, radiusM, windowMin]
  );
  const r = rows[0];
  return {
    vehicles: Number(r?.vehicles ?? 0),
    avg_speed: r?.avg_speed === null || r?.avg_speed === undefined ? null : Number(r.avg_speed),
  };
}
