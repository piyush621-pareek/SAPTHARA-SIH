import { request } from "undici";
import { env } from "../../config/env";

export interface BhuvanRoute {
  geometry: { type: string; coordinates: number[][][] };
  source: "bhuvan" | "osrm";
}

/**
 * Fetches a road route from Bhuvan's Shortest Path API (ISRO/NRSC).
 * Constraint: both points must be in the same Indian state.
 * Falls back to null so the caller can use OSRM instead.
 */
export async function getBhuvanRoute(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<BhuvanRoute | null> {
  const token = env.isro.bhuvanRoutingToken;
  if (!token) return null;

  const url =
    `https://bhuvan-app1.nrsc.gov.in/api/routing/curl_routing_state.php` +
    `?lat1=${lat1}&lon1=${lon1}&lat2=${lat2}&lon2=${lon2}&token=${token}`;

  try {
    const res = await request(url, {
      method: "GET",
      headersTimeout: env.isro.timeoutMs,
      bodyTimeout: env.isro.timeoutMs + 5000,
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const text = await res.body.text();
      if (text.includes("same state") || text === "false") return null;
      const data = JSON.parse(text) as {
        type?: string;
        features?: Array<{ geometry?: { type: string; coordinates: number[][][] } }>;
      };
      const geom = data.features?.[0]?.geometry;
      if (geom?.coordinates?.length) {
        return { geometry: geom, source: "bhuvan" };
      }
    }
  } catch {
    // fall through
  }
  return null;
}
