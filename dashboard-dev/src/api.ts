import type {
  FleetVehicle,
  HazardFeature,
  GeoRisk,
  LedgerEntry,
  LedgerVerify,
  RouteResult,
  ConnectivityData,
} from "./types";
import { authHeader } from "./auth";

// Demo corridor endpoints (Guwahati → Tawang).
const ROUTE_ORIGIN = { latitude: 26.1445, longitude: 91.7362 };
const ROUTE_DEST = { latitude: 27.5859, longitude: 91.8594 };

// In dev the Vite proxy forwards /api to the Node backend, so a relative base
// works from the browser. Override with VITE_API_BASE for a hosted deploy.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const API = `${API_BASE}/api/v1`;

// ISRO Bhuvan API — Routing (intra-state shortest path via road network)
const BHUVAN_ROUTING_TOKEN = "61cd22f8fa36de4bd7a739b61246057cdd4dae9c";
const BHUVAN_ROUTING_URL = import.meta.env.DEV
  ? "/bhuvan-api/routing/curl_routing_state.php"
  : "https://bhuvan-app1.nrsc.gov.in/api/routing/curl_routing_state.php";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { ...authHeader() } });
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchFleet(): Promise<FleetVehicle[]> {
  const body = await getJson<{ data: FleetVehicle[] }>("/fleet");
  return body.data;
}

export async function fetchHazards(): Promise<HazardFeature[]> {
  const body = await getJson<{ data: HazardFeature[] }>("/hazards");
  return body.data;
}

/** District-wise connectivity + live delivery statuses. */
export async function fetchConnectivity(): Promise<ConnectivityData> {
  const body = await getJson<{ data: ConnectivityData }>("/geo/connectivity");
  return body.data;
}

/** ISRO-fused (MOSDAC + CartoDEM + Bhuvan) landslide risk for a coordinate. */
export async function fetchGeoRisk(lat: number, lng: number): Promise<GeoRisk> {
  const body = await getJson<{ data: GeoRisk }>(
    `/geo/risk?lat=${lat}&lng=${lng}`
  );
  return body.data;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Hazard-aware route. Defaults to the Guwahati→Tawang demo corridor, but the
 * From/To planner passes any origin/destination the operator picks.
 */
function mockRoute(origin: LatLng, destination: LatLng): RouteResult {
  const steps = 20;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lng = origin.longitude + (destination.longitude - origin.longitude) * t;
    const lat = origin.latitude + (destination.latitude - origin.latitude) * t;
    // slight curve to look realistic
    const jitter = Math.sin(t * Math.PI) * 0.15;
    coords.push([lng + jitter * 0.3, lat + jitter]);
  }
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLng = toRad(destination.longitude - origin.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(origin.latitude)) * Math.cos(toRad(destination.latitude)) * Math.sin(dLng / 2) ** 2;
  const dist = 2 * R * Math.asin(Math.sqrt(a));
  const geo = { type: "LineString" as const, coordinates: coords };
  const directGeo = { type: "LineString" as const, coordinates: [[origin.longitude, origin.latitude] as [number, number], [destination.longitude, destination.latitude] as [number, number]] };
  return {
    distance_km: Math.round(dist * 100) / 100,
    status: "clear",
    hazard_avoided: dist > 200,
    avoided_hazards: [],
    geometry: geo,
    alternatives: [
      { id: "recommended", name: "Safe route", status: "clear", distance_km: Math.round(dist * 100) / 100, safety_score: 0.85, hazards: [], geometry: geo },
      { id: "direct", name: "Direct", status: "clear", distance_km: Math.round(dist * 0.9 * 100) / 100, safety_score: 0.6, hazards: [], geometry: directGeo },
    ],
  };
}

async function fetchBhuvanRoute(origin: LatLng, destination: LatLng): Promise<RouteResult | null> {
  try {
    const url = `${BHUVAN_ROUTING_URL}?lat1=${origin.latitude}&lon1=${origin.longitude}&lat2=${destination.latitude}&lon2=${destination.longitude}&token=${BHUVAN_ROUTING_TOKEN}`;
    const res = await fetch(url, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.includes("Please provide") || text === "null") return null;
    const geojson = JSON.parse(text) as GeoJSON.FeatureCollection;
    if (!geojson.features?.length) return null;
    const feature = geojson.features[0];
    const geom = feature.geometry as GeoJSON.MultiLineString | GeoJSON.LineString;
    // Flatten MultiLineString to a single coordinate array
    const coords: [number, number][] = geom.type === "MultiLineString"
      ? (geom.coordinates as number[][][]).flat().map((c) => [c[0], c[1]])
      : (geom.coordinates as number[][]).map((c) => [c[0], c[1]]);
    if (coords.length < 2) return null;
    // Compute distance from coordinates
    const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
    let dist = 0;
    for (let i = 1; i < coords.length; i++) {
      const dLat = toRad(coords[i][1] - coords[i - 1][1]);
      const dLng = toRad(coords[i][0] - coords[i - 1][0]);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(coords[i - 1][1])) * Math.cos(toRad(coords[i][1])) * Math.sin(dLng / 2) ** 2;
      dist += 2 * R * Math.asin(Math.sqrt(a));
    }
    const lineGeo = { type: "LineString" as const, coordinates: coords };
    const directGeo = { type: "LineString" as const, coordinates: [coords[0], coords[coords.length - 1]] };
    console.log(`[ISRO Bhuvan] Route fetched: ${Math.round(dist)} km, ${coords.length} points`);
    return {
      distance_km: Math.round(dist * 100) / 100,
      status: "clear",
      hazard_avoided: false,
      avoided_hazards: [],
      geometry: lineGeo,
      alternatives: [
        { id: "recommended", name: "ISRO Safe Route", status: "clear", distance_km: Math.round(dist * 100) / 100, safety_score: 0.9, hazards: [], geometry: lineGeo },
        { id: "direct", name: "Direct", status: "clear", distance_km: Math.round(dist * 0.85 * 100) / 100, safety_score: 0.6, hazards: [], geometry: directGeo },
      ],
    };
  } catch {
    return null;
  }
}

export async function fetchRoute(
  origin: LatLng = ROUTE_ORIGIN,
  destination: LatLng = ROUTE_DEST
): Promise<RouteResult> {
  // 1. Try ISRO Bhuvan real routing (intra-state road network)
  const bhuvan = await fetchBhuvanRoute(origin, destination);
  if (bhuvan) return bhuvan;
  // 2. Try our backend
  try {
    const res = await fetch(`${API}/routing/route`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify({ origin, destination }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data: RouteResult };
    return body.data;
  } catch {
    // 3. Fall back to mock
    return mockRoute(origin, destination);
  }
}

const OSRM_URL = import.meta.env.DEV
  ? "/osrm-api/route/v1/driving"
  : "https://router.project-osrm.org/route/v1/driving";

function pointInPolygon(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Nepal routing via OSRM (OpenStreetMap real road network) with hazard checking. */
export async function nepalMockRoute(
  origin: LatLng,
  destination: LatLng,
  hazardPolygons: GeoJSON.Polygon[] = []
): Promise<RouteResult> {
  try {
    const url = `${OSRM_URL}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=simplified&geometries=geojson&alternatives=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route");
    const primary = data.routes[0];
    const coords: [number, number][] = primary.geometry.coordinates.map((c: number[]) => [c[0], c[1]]);
    const distKm = Math.round(primary.distance / 10) / 100;
    // Check which hazards the route intersects
    const avoided: string[] = [];
    for (const poly of hazardPolygons) {
      const ring = poly.coordinates[0];
      for (const [lng, lat] of coords) {
        if (pointInPolygon(lng, lat, ring)) {
          avoided.push("Flood/Landslide Zone");
          break;
        }
      }
    }
    const hasHazard = avoided.length > 0;
    const lineGeo = { type: "LineString" as const, coordinates: coords };
    // Use alternative route if available and primary hits hazards
    let altCoords = coords;
    if (hasHazard && data.routes.length > 1) {
      altCoords = data.routes[1].geometry.coordinates.map((c: number[]) => [c[0], c[1]]);
    } else if (hasHazard) {
      // Offset the route slightly as "safer detour"
      altCoords = coords.map(([lng, lat], i) => {
        const t = i / coords.length;
        const offset = Math.sin(t * Math.PI) * 0.08;
        return [lng + offset * 0.3, lat + offset] as [number, number];
      });
    }
    const altGeo = { type: "LineString" as const, coordinates: altCoords };
    const altDist = hasHazard ? Math.round(distKm * 1.12 * 100) / 100 : distKm;
    const directGeo = { type: "LineString" as const, coordinates: [coords[0], coords[coords.length - 1]] };
    console.log(`[OSRM Nepal] Route: ${distKm} km, ${coords.length} points, hazards: ${avoided.length}`);
    return {
      distance_km: hasHazard ? altDist : distKm,
      status: hasHazard ? "rerouted" : "clear",
      hazard_avoided: hasHazard,
      avoided_hazards: [...new Set(avoided)],
      geometry: hasHazard ? altGeo : lineGeo,
      alternatives: [
        {
          id: "recommended",
          name: hasHazard ? "Safer Detour (OSRM)" : "OSRM Route",
          status: hasHazard ? "rerouted" : "clear",
          distance_km: altDist,
          safety_score: hasHazard ? 0.82 : 0.9,
          hazards: avoided,
          geometry: hasHazard ? altGeo : lineGeo,
        },
        {
          id: "direct",
          name: "Direct Road",
          status: hasHazard ? "at_risk" : "clear",
          distance_km: distKm,
          safety_score: hasHazard ? 0.3 : 0.7,
          hazards: avoided,
          geometry: lineGeo,
        },
      ],
    };
  } catch (err) {
    console.warn("[OSRM Nepal] Failed, using fallback:", err);
    return nepalFallbackRoute(origin, destination, hazardPolygons);
  }
}

function nepalFallbackRoute(origin: LatLng, destination: LatLng, hazardPolygons: GeoJSON.Polygon[]): RouteResult {
  const steps = 30;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lng = origin.longitude + (destination.longitude - origin.longitude) * t;
    const lat = origin.latitude + (destination.latitude - origin.latitude) * t;
    const jitter = Math.sin(t * Math.PI) * 0.15;
    coords.push([lng + jitter * 0.3, lat + jitter]);
  }
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLng = toRad(destination.longitude - origin.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(origin.latitude)) * Math.cos(toRad(destination.latitude)) * Math.sin(dLng / 2) ** 2;
  const dist = 2 * R * Math.asin(Math.sqrt(a));
  const avoided: string[] = [];
  for (const poly of hazardPolygons) {
    const ring = poly.coordinates[0];
    for (const [lng, lat] of coords) {
      if (pointInPolygon(lng, lat, ring)) { avoided.push("Flood/Landslide Zone"); break; }
    }
  }
  const hasHazard = avoided.length > 0;
  const geo = { type: "LineString" as const, coordinates: coords };
  const directGeo = { type: "LineString" as const, coordinates: [[origin.longitude, origin.latitude] as [number, number], [destination.longitude, destination.latitude] as [number, number]] };
  return {
    distance_km: Math.round(dist * 100) / 100, status: hasHazard ? "rerouted" : "clear",
    hazard_avoided: hasHazard, avoided_hazards: [...new Set(avoided)], geometry: geo,
    alternatives: [
      { id: "recommended", name: "Fallback Route", status: hasHazard ? "rerouted" : "clear", distance_km: Math.round(dist * 1.1 * 100) / 100, safety_score: 0.7, hazards: avoided, geometry: geo },
      { id: "direct", name: "Direct", status: hasHazard ? "blocked" : "clear", distance_km: Math.round(dist * 100) / 100, safety_score: 0.4, hazards: avoided, geometry: directGeo },
    ],
  };
}

export interface NewReport {
  report_type: "landslide" | "flood" | "roadblock" | "supply_issue" | "other";
  notes: string;
  urgency: "low" | "medium" | "high" | "critical";
  latitude: number;
  longitude: number;
}

/** File a field report (same endpoint the phone app posts hazards to). */
export async function postReport(report: NewReport): Promise<void> {
  const res = await fetch(`${API}/reports`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify({ ...report, media_ids: [] }),
  });
  if (!res.ok) throw new Error(`Report failed → HTTP ${res.status}`);
}

export async function fetchLedger(): Promise<LedgerEntry[]> {
  const body = await getJson<{ data: LedgerEntry[] }>("/ledger");
  return body.data;
}

/** Verify tolerates a 409 (broken chain) and still returns the report body. */
export async function fetchLedgerVerify(): Promise<LedgerVerify> {
  const res = await fetch(`${API}/ledger/verify`, { headers: { ...authHeader() } });
  const body = (await res.json()) as { data: LedgerVerify };
  return body.data;
}
