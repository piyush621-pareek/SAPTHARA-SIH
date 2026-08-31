import { request } from "undici";
import { env } from "../../config/env";

export interface LandslideSusceptibility {
  susceptibility: "low" | "moderate" | "high" | "severe";
  score: number; // 0..1
  source: "bhuvan_wms" | "modelled";
}

/**
 * Queries Bhuvan (NRSC/ISRO) WMS for landslide-susceptibility at a point using
 * a standard WMS GetFeatureInfo request. Live access needs a Bhuvan token; on
 * any failure we fall back to a terrain-belt model for the NER.
 */
export async function getLandslideSusceptibility(
  lat: number,
  lng: number
): Promise<LandslideSusceptibility> {
  const { bhuvanWmsUrl, bhuvanToken, bhuvanLandslideLayer, timeoutMs } = env.isro;

  // A ~0.02° bbox around the point; WMS GetFeatureInfo samples pixel (50,50).
  const d = 0.02;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetFeatureInfo",
    layers: bhuvanLandslideLayer,
    query_layers: bhuvanLandslideLayer,
    srs: "EPSG:4326",
    bbox,
    width: "101",
    height: "101",
    x: "50",
    y: "50",
    info_format: "application/json",
    ...(bhuvanToken ? { token: bhuvanToken } : {}),
  });

  try {
    const res = await request(`${bhuvanWmsUrl}?${params.toString()}`, {
      method: "GET",
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const data = (await res.body.json()) as {
        features?: Array<{ properties?: Record<string, unknown> }>;
      };
      const props = data.features?.[0]?.properties ?? {};
      const raw = String(
        props.susceptibility ?? props.class ?? props.LS_CLASS ?? ""
      ).toLowerCase();
      const mapped = mapClass(raw);
      if (mapped) return { ...mapped, source: "bhuvan_wms" };
    }
  } catch {
    // fall through to model
  }
  return { ...modelSusceptibility(lat, lng), source: "modelled" };
}

function mapClass(
  raw: string
): { susceptibility: LandslideSusceptibility["susceptibility"]; score: number } | null {
  if (raw.includes("severe") || raw.includes("very high"))
    return { susceptibility: "severe", score: 0.9 };
  if (raw.includes("high")) return { susceptibility: "high", score: 0.72 };
  if (raw.includes("moderate") || raw.includes("medium"))
    return { susceptibility: "moderate", score: 0.45 };
  if (raw.includes("low")) return { susceptibility: "low", score: 0.2 };
  return null;
}

/**
 * Fallback susceptibility model for the NER landslide belt: higher in the
 * Arunachal/Meghalaya highlands (lat > 26), lower in the Brahmaputra valley.
 */
function modelSusceptibility(
  lat: number,
  lng: number
): { susceptibility: LandslideSusceptibility["susceptibility"]; score: number } {
  const inHighlands = lat >= 26 && lng >= 90 && lng <= 97.5;
  const score = inHighlands ? 0.6 : 0.3;
  const susceptibility = score >= 0.6 ? "high" : "moderate";
  return { susceptibility, score };
}
