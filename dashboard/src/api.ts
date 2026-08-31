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

/** Hazard-aware route for the demo corridor (recomputes as hazards change). */
export async function fetchRoute(): Promise<RouteResult> {
  const res = await fetch(`${API}/routing/route`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify({ origin: ROUTE_ORIGIN, destination: ROUTE_DEST }),
  });
  const body = (await res.json()) as { data: RouteResult };
  return body.data;
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
