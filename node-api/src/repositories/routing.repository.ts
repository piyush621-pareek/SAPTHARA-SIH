import { query } from "../config/db";

export interface RoadNode {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface RoadEdgeStatus {
  id: number;
  source: number;
  target: number;
  name: string | null;
  length_km: number;
  hazard_labels: string[]; // active hazards this edge crosses (empty = clear)
  // Real road-following polyline (GeoJSON [lng,lat] order), source -> target.
  coordinates: [number, number][];
}

/** All graph nodes with coordinates. */
export async function getNodes(): Promise<RoadNode[]> {
  const { rows } = await query<RoadNode>(
    `SELECT id, name,
            ST_Y(geom::geometry) AS lat,
            ST_X(geom::geometry) AS lng
       FROM road_nodes
      ORDER BY id`
  );
  return rows;
}

/**
 * All edges, each tagged with the active hazards its geometry intersects
 * (ST_Intersects against live hazard polygons). This is the spatial heart of
 * the reroute: edges that cross a geofence come back with hazard_labels set.
 */
export async function getEdgesWithHazardStatus(): Promise<RoadEdgeStatus[]> {
  const { rows } = await query<RoadEdgeStatus & { geojson: string }>(
    `SELECT
        e.id, e.source, e.target, e.name,
        ST_Length(e.geom::geography) / 1000.0 AS length_km,
        ST_AsGeoJSON(e.geom) AS geojson,
        COALESCE(
          (SELECT array_agg(h.label)
             FROM hazards h
            WHERE h.active = TRUE
              AND (h.expires_at IS NULL OR h.expires_at > now())
              AND ST_Intersects(e.geom, h.area)),
          '{}'
        ) AS hazard_labels
      FROM road_edges e`
  );
  return rows.map((r) => {
    let coordinates: [number, number][] = [];
    try {
      coordinates = JSON.parse(r.geojson).coordinates ?? [];
    } catch {
      coordinates = [];
    }
    return {
      id: r.id,
      source: r.source,
      target: r.target,
      name: r.name,
      length_km: Number(r.length_km),
      hazard_labels: r.hazard_labels ?? [],
      coordinates,
    };
  });
}

/** Snaps an arbitrary coordinate to the nearest graph node. */
export async function nearestNode(lat: number, lng: number): Promise<RoadNode | null> {
  const { rows } = await query<RoadNode>(
    `SELECT id, name,
            ST_Y(geom::geometry) AS lat,
            ST_X(geom::geometry) AS lng
       FROM road_nodes
      ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      LIMIT 1`,
    [lng, lat]
  );
  return rows[0] ?? null;
}
