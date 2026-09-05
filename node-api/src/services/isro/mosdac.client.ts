import { request } from "undici";
import { env } from "../../config/env";
import { pool } from "../../config/db";

export interface WeatherReading {
  rainfall_mm: number; // last-24h accumulated rainfall
  soil_moisture: number; // 0..1
  source: "mosdac" | "mosdac-satellite" | "modelled";
}

/**
 * Fetches satellite-derived rainfall + soil moisture for a coordinate.
 * Priority:
 *   1. Real INSAT-3DR data ingested into PostGIS (mosdac_rainfall table)
 *   2. MOSDAC REST endpoint (if token is set — rarely works)
 *   3. Monsoon-season model fallback
 */
export async function getWeather(lat: number, lng: number): Promise<WeatherReading> {
  // 1. Try real ingested satellite data first
  const satellite = await queryIngestedRainfall(lat, lng);
  if (satellite !== null) {
    return {
      rainfall_mm: satellite,
      soil_moisture: clamp01(soilFromRain(satellite)),
      source: "mosdac-satellite",
    };
  }

  // 2. Try MOSDAC REST endpoint (usually unavailable)
  const { mosdacBaseUrl, mosdacToken, timeoutMs } = env.isro;
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    product: "rainfall_24h",
    ...(mosdacToken ? { token: mosdacToken } : {}),
  });

  try {
    const res = await request(`${mosdacBaseUrl}/pointdata?${params.toString()}`, {
      method: "GET",
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const data = (await res.body.json()) as {
        rainfall_mm?: number;
        rainfall?: number;
        soil_moisture?: number;
      };
      const rainfall = Number(data.rainfall_mm ?? data.rainfall);
      if (!Number.isNaN(rainfall)) {
        const sm =
          data.soil_moisture != null
            ? Number(data.soil_moisture)
            : soilFromRain(rainfall);
        return {
          rainfall_mm: rainfall,
          soil_moisture: clamp01(sm),
          source: "mosdac",
        };
      }
    }
  } catch {
    // fall through to model
  }

  // 3. Model fallback
  const modelled = modelWeather(lat, lng);
  return { ...modelled, source: "modelled" };
}

/**
 * Query ingested INSAT-3DR rainfall raster from PostGIS.
 * Reads the raw float32 pixel at the given lat/lng from the most recent raster.
 */
async function queryIngestedRainfall(lat: number, lng: number): Promise<number | null> {
  try {
    const result = await pool.query(
      `SELECT data, width, height, pixel_size, nodata,
              ST_XMin(bbox) AS xmin, ST_YMax(bbox) AS ymax
       FROM mosdac_rainfall
       WHERE ST_Contains(bbox, ST_SetSRID(ST_Point($1, $2), 4326))
       ORDER BY observed_at DESC
       LIMIT 1`,
      [lng, lat]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const px = Math.floor((lng - row.xmin) / row.pixel_size);
    const py = Math.floor((row.ymax - lat) / row.pixel_size);

    if (px < 0 || px >= row.width || py < 0 || py >= row.height) return null;

    const offset = (py * row.width + px) * 4;
    const buf = row.data as Buffer;
    if (offset + 4 > buf.length) return null;

    const val = buf.readFloatLE(offset);
    if (val === row.nodata || val < 0) return null;

    return Math.round(val * 100) / 100;
  } catch {
    return null;
  }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Antecedent soil saturation rises with recent rainfall (saturating). */
function soilFromRain(rain: number): number {
  return clamp01(1 - Math.exp(-rain / 150));
}

/**
 * Monsoon rainfall model for the NER (one of the wettest regions on Earth).
 * Deterministic per-coordinate + day-of-year seasonality so demos are stable.
 */
function modelWeather(lat: number, lng: number): {
  rainfall_mm: number;
  soil_moisture: number;
} {
  const month = new Date().getUTCMonth() + 1; // 1..12
  const monsoon = month >= 5 && month <= 9; // May–Sep
  const base = monsoon ? 140 : 35;
  const orographic = lat >= 25 && lng >= 90 ? 1.35 : 1.0;
  const jitter = ((Math.abs(Math.sin(lat * 12.9898 + lng * 78.233)) * 43) % 40);
  const rainfall = Math.round(base * orographic + jitter);
  return { rainfall_mm: rainfall, soil_moisture: soilFromRain(rainfall) };
}
