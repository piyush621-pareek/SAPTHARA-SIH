import { request } from "undici";
import { env } from "../../config/env";

export interface TerrainReading {
  elevation_m: number;
  slope_deg: number;
  source: "cartodem" | "modelled";
}

/**
 * Fetches elevation from CartoDEM (Cartosat-1 DEM via Bhuvan) at a point and a
 * small ring around it, then derives terrain slope from the elevation
 * differences. Live access needs a Bhuvan/CartoDEM token; on failure we fall
 * back to a regional relief model.
 */
export async function getTerrain(lat: number, lng: number): Promise<TerrainReading> {
  const { cartodemUrl, cartodemToken, timeoutMs } = env.isro;

  // Sample the centre and four neighbours (~90 m CartoDEM posting ≈ 0.0008°).
  const step = 0.0008;
  const samples: Array<[number, number]> = [
    [lat, lng],
    [lat + step, lng],
    [lat - step, lng],
    [lat, lng + step],
    [lat, lng - step],
  ];

  try {
    const elevations = await Promise.all(
      samples.map((s) => fetchElevation(cartodemUrl, cartodemToken, s[0], s[1], timeoutMs))
    );
    if (elevations.every((e) => e != null)) {
      const els = elevations as number[];
      const slope = slopeFromNeighbours(els, step);
      return { elevation_m: Math.round(els[0]), slope_deg: round1(slope), source: "cartodem" };
    }
  } catch {
    // fall through
  }

  const modelled = modelTerrain(lat, lng);
  return { ...modelled, source: "modelled" };
}

async function fetchElevation(
  baseUrl: string,
  token: string,
  lat: number,
  lng: number,
  timeoutMs: number
): Promise<number | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    ...(token ? { token } : {}),
  });
  const res = await request(`${baseUrl}/point?${params.toString()}`, {
    method: "GET",
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });
  if (res.statusCode < 200 || res.statusCode >= 300) return null;
  const data = (await res.body.json()) as { elevation?: number; z?: number };
  const z = Number(data.elevation ?? data.z);
  return Number.isNaN(z) ? null : z;
}

/** Slope (deg) from a centre + 4-neighbour elevation stencil. */
function slopeFromNeighbours(els: number[], stepDeg: number): number {
  const [, north, south, east, west] = els;
  const metresPerDeg = 111_320;
  const dz_dy = (north - south) / (2 * stepDeg * metresPerDeg);
  const dz_dx = (east - west) / (2 * stepDeg * metresPerDeg);
  const grade = Math.sqrt(dz_dx ** 2 + dz_dy ** 2);
  return (Math.atan(grade) * 180) / Math.PI;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Regional relief model: the NER highlands (Arunachal/Meghalaya) are steep;
 * the Brahmaputra valley is flat. Deterministic per coordinate.
 */
function modelTerrain(lat: number, lng: number): {
  elevation_m: number;
  slope_deg: number;
} {
  const highlands = lat >= 26.2 && lng >= 90 && lng <= 97.5;
  const elevation = highlands
    ? 900 + Math.round((Math.abs(Math.sin(lat * 3 + lng)) % 1) * 2200)
    : 60 + Math.round((Math.abs(Math.cos(lat + lng)) % 1) * 120);
  const slope = highlands
    ? 22 + ((Math.abs(Math.sin(lat * 7.1 + lng * 3.3)) * 30) % 30)
    : 2 + ((Math.abs(Math.cos(lat * 5 + lng)) * 6) % 6);
  return { elevation_m: elevation, slope_deg: round1(slope) };
}
