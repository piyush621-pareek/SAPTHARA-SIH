import { query } from "../config/db";
import { CreateHazardBody } from "../schemas/hazard.schema";

export interface HazardRow {
  id: string;
  label: string;
  kind: string;
  severity: number;
  risk_score: number;
  distance_m?: number;
  centroid_lng?: number;
  centroid_lat?: number;
}

/**
 * Builds a WKT POLYGON from an outer ring of [lng, lat] pairs. The ring is
 * closed automatically (first vertex appended as last) if not already closed.
 */
function ringToWkt(ring: [number, number][]): string {
  const closed = [...ring];
  const [fx, fy] = closed[0];
  const [lx, ly] = closed[closed.length - 1];
  if (fx !== lx || fy !== ly) closed.push([fx, fy]);
  const coords = closed.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
  return `POLYGON((${coords}))`;
}

/**
 * Persists a hazard. The polygon is validated + normalized with ST_MakeValid,
 * and the centroid geography is derived server-side for radius queries.
 */
export async function createHazard(input: CreateHazardBody): Promise<HazardRow> {
  const wkt = ringToWkt(input.ring as [number, number][]);
  const { rows } = await query<HazardRow>(
    `INSERT INTO hazards
       (label, kind, severity, risk_score, area, centroid, expires_at)
     VALUES
       ($1, $2, $3, $4,
        ST_MakeValid(ST_GeomFromText($5, 4326)),
        ST_Centroid(ST_GeomFromText($5, 4326))::geography,
        $6)
     RETURNING id, label, kind, severity, risk_score`,
    [
      input.label,
      input.kind,
      input.severity,
      input.risk_score,
      wkt,
      input.expires_at ?? null,
    ]
  );
  return rows[0];
}

/**
 * Lists every active hazard with its polygon serialized as GeoJSON, for the
 * command dashboard's initial map render.
 */
export async function listActiveHazards(
  limit = 200,
  offset = 0
): Promise<
  Array<{
    id: string;
    label: string;
    kind: string;
    severity: number;
    risk_score: number;
    geometry: unknown;
  }>
> {
  const { rows } = await query<{
    id: string;
    label: string;
    kind: string;
    severity: number;
    risk_score: number;
    geometry: string;
  }>(
    `SELECT id, label, kind, severity, risk_score,
            ST_AsGeoJSON(area) AS geometry
       FROM hazards
      WHERE active = TRUE
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
    severity: r.severity,
    risk_score: Number(r.risk_score),
    geometry: JSON.parse(r.geometry),
  }));
}

/**
 * Proximity search: active hazards whose CENTROID lies within `radius_m`
 * metres of the given point, using the geography ST_DWithin (great-circle,
 * metre-accurate) and a GiST index on hazards.centroid.
 */
export async function findNearbyHazards(
  lat: number,
  lng: number,
  radiusM: number
): Promise<HazardRow[]> {
  const { rows } = await query<HazardRow>(
    `SELECT
        id, label, kind, severity, risk_score,
        ST_Distance(
          centroid,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) AS distance_m,
        ST_X(centroid::geometry) AS centroid_lng,
        ST_Y(centroid::geometry) AS centroid_lat
      FROM hazards
     WHERE active = TRUE
       AND (expires_at IS NULL OR expires_at > now())
       AND ST_DWithin(
             centroid,
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             $3
           )
     ORDER BY distance_m ASC`,
    [lng, lat, radiusM]
  );
  return rows;
}

/**
 * Geofence collision: returns every active hazard polygon that CONTAINS the
 * point, using planar ST_Contains against the geometry column (GiST-indexed).
 */
export async function findContainingHazards(
  lat: number,
  lng: number
): Promise<HazardRow[]> {
  const { rows } = await query<HazardRow>(
    `SELECT id, label, kind, severity, risk_score
       FROM hazards
      WHERE active = TRUE
        AND (expires_at IS NULL OR expires_at > now())
        AND ST_Contains(area, ST_SetSRID(ST_MakePoint($1, $2), 4326))`,
    [lng, lat]
  );
  return rows;
}
