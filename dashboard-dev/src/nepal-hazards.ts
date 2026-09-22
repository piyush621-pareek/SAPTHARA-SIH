import type { HazardFeature } from "./types";

export interface NepalHazard extends HazardFeature {
  country: "NP";
  type: "flood" | "landslide" | "road_closure" | "bridge_damage";
  name: string;
  source: string;
  observed_at: string;
  valid_until: string;
  confidence: number;
  status: "active" | "monitoring" | "resolved";
  is_demo: boolean;
}

// Demo fixture — deterministic Nepal flood/landslide zones shown when
// external feeds are unavailable. All marked is_demo: true.
export const NEPAL_DEMO_HAZARDS: NepalHazard[] = [
  {
    id: "np-flood-koshi",
    label: "Koshi River Flood Zone",
    kind: "flood",
    severity: 4,
    risk_score: 0.92,
    country: "NP",
    type: "flood",
    name: "Koshi River Basin Flooding",
    source: "Demo fixture",
    observed_at: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    confidence: 0.7,
    status: "active",
    is_demo: true,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [86.85, 26.45], [87.25, 26.45], [87.35, 26.65], [87.40, 26.90],
        [87.30, 27.05], [87.10, 27.10], [86.90, 26.95], [86.80, 26.70],
        [86.85, 26.45],
      ]],
    },
  },
  {
    id: "np-flood-narayani",
    label: "Narayani River Flood Zone",
    kind: "flood",
    severity: 3,
    risk_score: 0.78,
    country: "NP",
    type: "flood",
    name: "Narayani Basin Monsoon Flooding",
    source: "Demo fixture",
    observed_at: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    confidence: 0.65,
    status: "active",
    is_demo: true,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [83.90, 27.55], [84.20, 27.50], [84.50, 27.60], [84.55, 27.80],
        [84.30, 27.90], [84.00, 27.85], [83.85, 27.70], [83.90, 27.55],
      ]],
    },
  },
  {
    id: "np-landslide-muglin",
    label: "Mugling-Narayanghat Landslide",
    kind: "landslide",
    severity: 5,
    risk_score: 0.95,
    country: "NP",
    type: "landslide",
    name: "Mugling Highway Landslide Zone",
    source: "Demo fixture",
    observed_at: new Date().toISOString(),
    valid_until: new Date(Date.now() + 43200000).toISOString(),
    confidence: 0.8,
    status: "active",
    is_demo: true,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [84.55, 27.85], [84.65, 27.82], [84.70, 27.90], [84.68, 27.98],
        [84.58, 27.97], [84.52, 27.92], [84.55, 27.85],
      ]],
    },
  },
  {
    id: "np-road-closure-prithvi",
    label: "Prithvi Highway Closure",
    kind: "roadblock",
    severity: 4,
    risk_score: 0.88,
    country: "NP",
    type: "road_closure",
    name: "Prithvi Highway blocked due to landslide debris",
    source: "Demo fixture",
    observed_at: new Date().toISOString(),
    valid_until: new Date(Date.now() + 72000000).toISOString(),
    confidence: 0.85,
    status: "active",
    is_demo: true,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [84.82, 27.92], [84.88, 27.90], [84.92, 27.95], [84.87, 27.98],
        [84.80, 27.96], [84.82, 27.92],
      ]],
    },
  },
  {
    id: "np-flood-rapti",
    label: "Rapti River Flood Zone",
    kind: "flood",
    severity: 3,
    risk_score: 0.72,
    country: "NP",
    type: "flood",
    name: "Rapti Valley Flooding",
    source: "Demo fixture",
    observed_at: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    confidence: 0.6,
    status: "active",
    is_demo: true,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [82.60, 28.00], [82.90, 27.95], [83.10, 28.05], [83.05, 28.25],
        [82.80, 28.30], [82.55, 28.15], [82.60, 28.00],
      ]],
    },
  },
];

// Nepal demo fleet vehicles
export const NEPAL_DEMO_FLEET = [
  { id: "np-truck-01", registration: "BA01KA1234", status: "active", latitude: 27.7172, longitude: 85.3240, last_seen_at: new Date().toISOString() },
  { id: "np-truck-02", registration: "BA05KA5678", status: "active", latitude: 28.2096, longitude: 83.9856, last_seen_at: new Date().toISOString() },
  { id: "np-truck-03", registration: "ME01PA9012", status: "active", latitude: 26.4525, longitude: 87.2718, last_seen_at: new Date().toISOString() },
  { id: "np-truck-04", registration: "LU03KA3456", status: "active", latitude: 27.6833, longitude: 84.4333, last_seen_at: new Date().toISOString() },
  { id: "np-truck-05", registration: "SE02PA7890", status: "active", latitude: 28.0500, longitude: 81.6167, last_seen_at: new Date().toISOString() },
];
