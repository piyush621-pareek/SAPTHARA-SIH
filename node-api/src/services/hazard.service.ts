import { request } from "undici";
import {
  createHazard,
  findNearbyHazards,
  findContainingHazards,
  listActiveHazards,
  HazardRow,
} from "../repositories/hazard.repository";
import { CreateHazardBody } from "../schemas/hazard.schema";
import { cacheGet, cacheSet } from "../config/redis";
import { env } from "../config/env";

const NEARBY_CACHE_TTL = 30; // seconds

/**
 * Registers a new dynamic hazard polygon.
 */
export async function registerHazard(input: CreateHazardBody): Promise<HazardRow> {
  return createHazard(input);
}

/** Returns all active hazards (polygons as GeoJSON) for the dashboard map. */
export async function getAllHazards(limit?: number, offset?: number) {
  return listActiveHazards(limit, offset);
}

/**
 * Proximity query (ST_DWithin). Results are cached per rounded coordinate +
 * radius bucket to shield the DB from dashboard polling storms.
 */
export async function getNearbyHazards(
  lat: number,
  lng: number,
  radiusM: number
): Promise<HazardRow[]> {
  // Round to ~100m grid so nearby polls share a cache key.
  const key = `hz:near:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusM}`;
  const cached = await cacheGet<HazardRow[]>(key);
  if (cached) return cached;

  const rows = await findNearbyHazards(lat, lng, radiusM);
  await cacheSet(key, rows, NEARBY_CACHE_TTL);
  return rows;
}

/**
 * Geofence collision check (ST_Contains) — is this coordinate inside any active
 * hazard polygon right now?
 */
export async function checkContainment(
  lat: number,
  lng: number
): Promise<{ inside: boolean; hazards: HazardRow[] }> {
  const hazards = await findContainingHazards(lat, lng);
  return { inside: hazards.length > 0, hazards };
}

/**
 * Predictive rerouting risk lookup. Enriches a coordinate with the AI
 * microservice's monsoon landslide risk score, falling back gracefully to the
 * spatial risk of the nearest hazard if the AI service is unreachable.
 */
export async function assessRouteRisk(params: {
  latitude: number;
  longitude: number;
  rainfall_mm: number;
  soil_moisture: number;
  slope: number;
}): Promise<{
  risk_score: number;
  recommended_action: string;
  source: "ai_service" | "spatial_fallback";
}> {
  try {
    const res = await request(`${env.aiServiceUrl}/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      headersTimeout: 4000,
      bodyTimeout: 4000,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const data = (await res.body.json()) as {
        risk_score: number;
        recommended_action: string;
      };
      return { ...data, source: "ai_service" };
    }
  } catch {
    // fall through to spatial fallback
  }

  // Fallback: derive risk from the nearest active hazard within 10 km.
  const nearby = await findNearbyHazards(params.latitude, params.longitude, 10_000);
  const risk = nearby.length > 0 ? Number(nearby[0].risk_score) : 0.1;
  return {
    risk_score: risk,
    recommended_action:
      risk >= 0.6 ? "REROUTE" : risk >= 0.3 ? "CAUTION" : "PROCEED",
    source: "spatial_fallback",
  };
}
