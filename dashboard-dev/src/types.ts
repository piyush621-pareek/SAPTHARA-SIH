// Shared domain types for the command dashboard.

export interface FleetVehicle {
  id: string;
  registration: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  last_seen_at: string | null;
}

/** Live position pushed over Socket.IO `fleet:update`. */
export interface FleetPosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speedKmph: number | null;
  headingDeg: number | null;
  at: string;
}

export interface HazardFeature {
  id: string;
  label: string;
  kind: string;
  severity: number;
  risk_score: number;
  geometry: GeoJSON.Polygon;
}

export interface HazardBreach {
  vehicleId: string;
  at: string;
  location: { latitude: number; longitude: number };
  hazards: Array<{ id: string; label: string }>;
}

export interface EmergencyAlert {
  incidentId: string;
  vehicleId: string | null;
  channel: string;
  message: string;
  location: { latitude: number; longitude: number };
  insideHazards: Array<{ label: string }>;
  at: string;
}

export interface GeoRisk {
  context: {
    latitude: number;
    longitude: number;
    rainfall_mm: number;
    soil_moisture: number;
    slope_deg: number;
    elevation_m: number;
    landslide_susceptibility: string;
    susceptibility_score: number;
    sources: { rainfall: string; terrain: string; susceptibility: string };
  };
  ai: {
    risk_score: number;
    recommended_action: string;
    severity_band?: string;
    source: string;
  };
  fused_risk: number;
  recommended_action: string;
  flood: { risk_score: number; recommended_action: string };
  congestion: {
    risk_score: number;
    recommended_action: string;
    vehicles: number;
    avg_speed_kmph: number | null;
  };
}

export interface RouteAlt {
  id: string;
  name: string;
  status: string;
  distance_km: number;
  safety_score: number;
  hazards: string[];
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface RouteResult {
  distance_km: number;
  status: string;
  hazard_avoided: boolean;
  avoided_hazards: string[];
  geometry: { type: "LineString"; coordinates: [number, number][] };
  alternatives: RouteAlt[];
}

export interface LedgerEntry {
  seq: number;
  event_type: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  created_at: string;
}

export interface LedgerVerify {
  valid: boolean;
  length: number;
  brokenAtSeq: number | null;
  reason: string | null;
}

export type AlertKind = "sos" | "breach" | "delivery";

export interface DistrictStatus {
  node_id: number;
  city: string;
  district: string;
  state: string;
  status: "open" | "at_risk" | "blocked";
  routes_total: number;
  routes_blocked: number;
  hazards: string[];
}

export interface DeliveryInfo {
  vehicle_id: string;
  registration: string;
  status: "on_time" | "at_risk" | "delayed";
  reason: string;
  estimated_delay_min: number;
  latitude: number | null;
  longitude: number | null;
  nearest_hazard: string | null;
}

export interface ConnectivityData {
  districts: DistrictStatus[];
  deliveries: DeliveryInfo[];
  summary: { total: number; on_time: number; at_risk: number; delayed: number };
  district_summary: { open: number; at_risk: number; blocked: number };
}

export interface DeliveryDelayedEvent {
  vehicle_id: string;
  registration: string;
  reason: string;
  estimated_delay_min: number;
  latitude: number | null;
  longitude: number | null;
  ts: number;
}

export interface FeedItem {
  id: string;
  kind: AlertKind;
  title: string;
  detail: string;
  vehicle: string;
  at: string;
  location: { latitude: number; longitude: number };
}
