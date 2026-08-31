import { request } from "undici";
import { env } from "../../config/env";

export interface WeatherReading {
  rainfall_mm: number; // last-24h accumulated rainfall
  soil_moisture: number; // 0..1
  source: "mosdac" | "modelled";
}

/**
 * Fetches satellite-derived rainfall + soil moisture for a coordinate from
 * MOSDAC (SAC/ISRO). Live access needs a MOSDAC token; on failure we fall back
 * to a monsoon-season model tuned to the NER's very high rainfall regime.
 */
export async function getWeather(lat: number, lng: number): Promise<WeatherReading> {
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

  const modelled = modelWeather(lat, lng);
  return { ...modelled, source: "modelled" };
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
  // Windward Meghalaya/Arunachal slopes get orographic enhancement.
  const orographic = lat >= 25 && lng >= 90 ? 1.35 : 1.0;
  const jitter = ((Math.abs(Math.sin(lat * 12.9898 + lng * 78.233)) * 43) % 40);
  const rainfall = Math.round(base * orographic + jitter);
  return { rainfall_mm: rainfall, soil_moisture: soilFromRain(rainfall) };
}
