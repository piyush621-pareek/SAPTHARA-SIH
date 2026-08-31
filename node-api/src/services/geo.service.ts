import { request } from "undici";
import { env } from "../config/env";
import { getWeather } from "./isro/mosdac.client";
import { getTerrain } from "./isro/cartodem.client";
import { getLandslideSusceptibility } from "./isro/bhuvan.client";
import { getTrafficNear } from "../repositories/connectivity.repository";

export interface EnvironmentalContext {
  latitude: number;
  longitude: number;
  rainfall_mm: number;
  soil_moisture: number;
  slope_deg: number;
  elevation_m: number;
  landslide_susceptibility: string;
  susceptibility_score: number;
  sources: {
    rainfall: string;
    terrain: string;
    susceptibility: string;
  };
}

/**
 * Fuses the three ISRO feeds for a coordinate:
 *   MOSDAC  → rainfall + soil moisture
 *   CartoDEM → elevation + slope
 *   Bhuvan   → landslide susceptibility class
 * Each field is tagged with whether it came from the live service or the model.
 */
export async function getEnvironmentalContext(
  latitude: number,
  longitude: number
): Promise<EnvironmentalContext> {
  const [weather, terrain, susceptibility] = await Promise.all([
    getWeather(latitude, longitude),
    getTerrain(latitude, longitude),
    getLandslideSusceptibility(latitude, longitude),
  ]);

  return {
    latitude,
    longitude,
    rainfall_mm: weather.rainfall_mm,
    soil_moisture: weather.soil_moisture,
    slope_deg: terrain.slope_deg,
    elevation_m: terrain.elevation_m,
    landslide_susceptibility: susceptibility.susceptibility,
    susceptibility_score: susceptibility.score,
    sources: {
      rainfall: weather.source,
      terrain: terrain.source,
      susceptibility: susceptibility.source,
    },
  };
}

export interface DataDrivenRisk {
  context: EnvironmentalContext;
  ai: {
    risk_score: number;
    recommended_action: string;
    severity_band?: string;
    source: "ai_service" | "heuristic_fallback";
  };
  fused_risk: number;
  recommended_action: string;
  // Multi-hazard disruption prediction (PS 26002 b).
  flood: {
    risk_score: number;
    recommended_action: string;
    model_source: string;
    factors: { rain: number; low_elevation: number; flat_terrain: number };
  };
  congestion: {
    risk_score: number;
    recommended_action: string;
    model_source: string;
    vehicles: number;
    avg_speed_kmph: number | null;
  };
}

function bandAction(score: number): string {
  return score >= 0.7 ? "HALT" : score >= 0.5 ? "REROUTE" : score >= 0.3 ? "CAUTION" : "PROCEED";
}

/** POST a small JSON body to the AI service; null if unavailable. */
async function aiPost(
  path: string,
  body: unknown
): Promise<{ risk_score: number; recommended_action: string; model_source: string } | null> {
  try {
    const res = await request(`${env.aiServiceUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      headersTimeout: 4000,
      bodyTimeout: 4000,
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return (await res.body.json()) as {
        risk_score: number;
        recommended_action: string;
        model_source: string;
      };
    }
  } catch {
    /* fall through to heuristic */
  }
  return null;
}

/** Flood risk: trained DFO flood model (fallback: low+flat+wet heuristic). */
async function floodRisk(ctx: EnvironmentalContext) {
  const rain = 1 - Math.exp(-ctx.rainfall_mm / 80);
  const lowElev = clamp01((600 - ctx.elevation_m) / 600);
  const flat = clamp01((12 - ctx.slope_deg) / 12);
  const ai = await aiPost("/predict/flood", {
    rainfall_mm: ctx.rainfall_mm,
    soil_moisture: ctx.soil_moisture,
    elevation: ctx.elevation_m,
    slope: ctx.slope_deg,
  });
  const score = ai
    ? ai.risk_score
    : clamp01(1 / (1 + Math.exp(-(-2.5 + 3.2 * rain + 2.2 * lowElev + 1.4 * flat))));
  return {
    risk_score: round3(score),
    recommended_action: ai ? ai.recommended_action : bandAction(score),
    model_source: ai ? ai.model_source : "heuristic",
    factors: { rain: round3(rain), low_elevation: round3(lowElev), flat_terrain: round3(flat) },
  };
}

/** Congestion: trained UCI traffic model (time/weather baseline) blended with
 *  live fleet telemetry (density + speed). */
async function congestionRisk(
  vehicles: number,
  avgSpeed: number | null,
  rainfall_mm: number
) {
  const now = new Date();
  const pandasDow = (now.getDay() + 6) % 7; // JS Sun=0 -> pandas Mon=0..Sun=6
  const ai = await aiPost("/predict/congestion", {
    hour: now.getHours(),
    day_of_week: pandasDow,
    is_weekend: pandasDow >= 5 ? 1 : 0,
    rain_mm: Math.min(rainfall_mm / 24, 50),
  });
  const baseline = ai ? ai.risk_score : 0.3;
  // Live telemetry signal: many vehicles moving slowly => congested.
  const density = clamp01(vehicles / 6);
  const slow = avgSpeed == null ? 0 : clamp01((40 - avgSpeed) / 40);
  const telemetry = clamp01(0.6 * density + 0.6 * slow * density);
  const score = clamp01(0.5 * baseline + 0.5 * telemetry);
  return {
    risk_score: round3(score),
    recommended_action: bandAction(score),
    model_source: ai ? ai.model_source : "heuristic",
  };
}

/**
 * The headline feature: pull real satellite-derived inputs from ISRO feeds,
 * run them through the FastAPI landslide model, then blend with Bhuvan's
 * susceptibility class. Also derives flood + congestion disruption risk for the
 * same point so the platform predicts all the disruption types in PS 26002 (b).
 */
export async function getDataDrivenRisk(
  latitude: number,
  longitude: number
): Promise<DataDrivenRisk> {
  const [context, traffic] = await Promise.all([
    getEnvironmentalContext(latitude, longitude),
    getTrafficNear(latitude, longitude),
  ]);

  const ai = await callAiModel({
    latitude,
    longitude,
    rainfall_mm: context.rainfall_mm,
    soil_moisture: context.soil_moisture,
    slope: context.slope_deg,
    elevation: context.elevation_m,
  });

  // Blend the dynamic AI score with Bhuvan's static susceptibility (70/30).
  const fused = clamp01(0.7 * ai.risk_score + 0.3 * context.susceptibility_score);
  const action = fused >= 0.8 ? "HALT" : fused >= 0.6 ? "REROUTE" : fused >= 0.35 ? "CAUTION" : "PROCEED";

  const [flood, congestionCore] = await Promise.all([
    floodRisk(context),
    congestionRisk(traffic.vehicles, traffic.avg_speed, context.rainfall_mm),
  ]);
  const congestion = {
    ...congestionCore,
    vehicles: traffic.vehicles,
    avg_speed_kmph: traffic.avg_speed === null ? null : round3(traffic.avg_speed),
  };

  return { context, ai, fused_risk: round3(fused), recommended_action: action, flood, congestion };
}

async function callAiModel(input: {
  latitude: number;
  longitude: number;
  rainfall_mm: number;
  soil_moisture: number;
  slope: number;
  elevation?: number;
}): Promise<DataDrivenRisk["ai"]> {
  try {
    const res = await request(`${env.aiServiceUrl}/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      headersTimeout: 4000,
      bodyTimeout: 4000,
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const d = (await res.body.json()) as {
        risk_score: number;
        recommended_action: string;
        severity_band?: string;
      };
      return { ...d, source: "ai_service" };
    }
  } catch {
    // fall through to a local heuristic
  }
  // Heuristic fallback mirrors the Python model's shape.
  const z =
    -3.2 +
    3.6 * (1 - Math.exp(-input.rainfall_mm / 120)) +
    3.9 * Math.pow(input.soil_moisture, 0.75) +
    3.1 * Math.min(1, input.slope / 45);
  const risk = 1 / (1 + Math.exp(-z));
  return {
    risk_score: round3(risk),
    recommended_action: risk >= 0.6 ? "REROUTE" : risk >= 0.35 ? "CAUTION" : "PROCEED",
    source: "heuristic_fallback",
  };
}

/**
 * WMS layer descriptors the dashboard/app can add to their map (Bhuvan basemap +
 * terrain, and the landslide-susceptibility overlay).
 */
export function getBhuvanLayers() {
  return {
    landslide: {
      type: "wms",
      url: env.isro.bhuvanWmsUrl,
      layer: env.isro.bhuvanLandslideLayer,
      format: "image/png",
      transparent: true,
      attribution: "Bhuvan, NRSC/ISRO",
    },
    terrain: {
      type: "wms",
      url: env.isro.bhuvanWmsUrl,
      layer: "lulc:DEM_CARTODEM_HILLSHADE",
      format: "image/png",
      attribution: "CartoDEM, Cartosat-1, NRSC/ISRO",
    },
  };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;
