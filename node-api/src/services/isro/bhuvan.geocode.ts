import { request } from "undici";
import { env } from "../../config/env";

export interface VillageResult {
  name: string;
  latitude: number;
  longitude: number;
  district: string;
  state: string;
  population: number;
}

/**
 * Geocodes a village name using Bhuvan's Village Geocoding API (ISRO/NRSC).
 * Returns census-linked results with coordinates and demographics.
 */
export async function geocodeVillage(
  village: string
): Promise<VillageResult[]> {
  const token = env.isro.bhuvanGeocodingToken;
  if (!token) return [];

  const url =
    `https://bhuvan-app1.nrsc.gov.in/api/api_proximity/curl_village_geocode.php` +
    `?village=${encodeURIComponent(village)}&token=${token}`;

  try {
    const res = await request(url, {
      method: "GET",
      headersTimeout: env.isro.timeoutMs,
      bodyTimeout: env.isro.timeoutMs,
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const text = await res.body.text();
      if (text === "false" || !text.startsWith("[")) return [];
      const data = JSON.parse(text) as Array<{
        name?: string;
        latitude?: string;
        longitude?: string;
        dist_name?: string;
        state_name?: string;
        tot_p?: string;
      }>;
      return data.map((v) => ({
        name: v.name ?? village,
        latitude: parseFloat(v.latitude ?? "0"),
        longitude: parseFloat(v.longitude ?? "0"),
        district: v.dist_name ?? "",
        state: v.state_name ?? "",
        population: parseInt(v.tot_p ?? "0", 10),
      }));
    }
  } catch {
    // fall through
  }
  return [];
}
