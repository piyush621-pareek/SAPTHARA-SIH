import { getNodes, getEdgesWithHazardStatus } from "../repositories/routing.repository";
import { getActiveDeliveries, DeliveryRow } from "../repositories/connectivity.repository";
import { emitAlert } from "../config/socket";

// City -> {district, state} for the 21 graph nodes. Lets us present the
// requirement's "district-wise connectivity status".
const PLACE: Record<string, { district: string; state: string }> = {
  Guwahati: { district: "Kamrup Metro", state: "Assam" },
  Tezpur: { district: "Sonitpur", state: "Assam" },
  Bhalukpong: { district: "West Kameng", state: "Arunachal Pradesh" },
  Bomdila: { district: "West Kameng", state: "Arunachal Pradesh" },
  Dirang: { district: "West Kameng", state: "Arunachal Pradesh" },
  "Sela Pass": { district: "Tawang", state: "Arunachal Pradesh" },
  "Sela Bypass": { district: "Tawang", state: "Arunachal Pradesh" },
  Tawang: { district: "Tawang", state: "Arunachal Pradesh" },
  Shillong: { district: "East Khasi Hills", state: "Meghalaya" },
  Silchar: { district: "Cachar", state: "Assam" },
  Nagaon: { district: "Nagaon", state: "Assam" },
  Jorhat: { district: "Jorhat", state: "Assam" },
  Dibrugarh: { district: "Dibrugarh", state: "Assam" },
  Dimapur: { district: "Dimapur", state: "Nagaland" },
  Kohima: { district: "Kohima", state: "Nagaland" },
  Imphal: { district: "Imphal West", state: "Manipur" },
  Aizawl: { district: "Aizawl", state: "Mizoram" },
  Agartala: { district: "West Tripura", state: "Tripura" },
  Itanagar: { district: "Papum Pare", state: "Arunachal Pradesh" },
  Tura: { district: "West Garo Hills", state: "Meghalaya" },
  Gangtok: { district: "Gangtok", state: "Sikkim" },
};

export type Connectivity = "open" | "at_risk" | "blocked";

export interface DistrictStatus {
  node_id: number;
  city: string;
  district: string;
  state: string;
  status: Connectivity;
  routes_total: number;
  routes_blocked: number;
  hazards: string[];
}

export type DeliveryStatus = "on_time" | "at_risk" | "delayed";

export interface DeliveryInfo {
  vehicle_id: string;
  registration: string;
  status: DeliveryStatus;
  reason: string;
  estimated_delay_min: number;
  latitude: number | null;
  longitude: number | null;
  nearest_hazard: string | null;
}

const STALE_SEC = 45; // no telemetry for this long => lost contact / stalled
const AT_RISK_KM = 20; // within this distance of a hazard => at risk

/** District-/city-wise connectivity derived from live hazard geofences. */
export async function getConnectivity(): Promise<DistrictStatus[]> {
  const [nodes, edges] = await Promise.all([getNodes(), getEdgesWithHazardStatus()]);
  return nodes.map((n) => {
    const incident = edges.filter((e) => e.source === n.id || e.target === n.id);
    const blockedEdges = incident.filter((e) => e.hazard_labels.length > 0);
    const hazards = [...new Set(blockedEdges.flatMap((e) => e.hazard_labels))];
    let status: Connectivity = "open";
    if (incident.length > 0 && blockedEdges.length === incident.length) status = "blocked";
    else if (blockedEdges.length > 0) status = "at_risk";
    const place = PLACE[n.name] ?? { district: n.name, state: "NER" };
    return {
      node_id: n.id,
      city: n.name,
      district: place.district,
      state: place.state,
      status,
      routes_total: incident.length,
      routes_blocked: blockedEdges.length,
      hazards,
    };
  });
}

function classify(d: DeliveryRow): DeliveryInfo {
  let status: DeliveryStatus = "on_time";
  let reason = "On schedule";
  let delay = 0;
  if (d.in_hazard) {
    status = "delayed";
    reason = `Blocked in ${d.nearest_hazard ?? "hazard zone"}`;
    delay = 90;
  } else if (d.age_sec !== null && d.age_sec > STALE_SEC) {
    status = "delayed";
    reason = `Lost contact (${Math.round(d.age_sec)}s)`;
    delay = 45;
  } else if (d.nearest_hazard_km !== null && d.nearest_hazard_km <= AT_RISK_KM) {
    status = "at_risk";
    reason = `Hazard ${d.nearest_hazard_km.toFixed(0)} km ahead (${d.nearest_hazard})`;
    delay = 30;
  }
  return {
    vehicle_id: d.id,
    registration: d.registration,
    status,
    reason,
    estimated_delay_min: delay,
    latitude: d.latitude,
    longitude: d.longitude,
    nearest_hazard: d.nearest_hazard,
  };
}

export async function getDeliveries(): Promise<DeliveryInfo[]> {
  const rows = await getActiveDeliveries();
  return rows.map(classify);
}

// ---------------------------------------------------------------------------
// Delivery-delay monitor: periodically re-evaluates deliveries and emits a
// `delivery:delayed` socket alert when one newly enters a delayed state, so the
// dashboard raises an automated alert (requirement e).
// ---------------------------------------------------------------------------
const delayedNow = new Set<string>();

export function startDeliveryMonitor(intervalMs = 10_000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const deliveries = await getDeliveries();
      for (const d of deliveries) {
        const was = delayedNow.has(d.vehicle_id);
        const is = d.status === "delayed";
        if (is && !was) {
          emitAlert("delivery:delayed", {
            vehicle_id: d.vehicle_id,
            registration: d.registration,
            reason: d.reason,
            estimated_delay_min: d.estimated_delay_min,
            latitude: d.latitude,
            longitude: d.longitude,
            ts: Date.now(),
          });
        }
        if (is) delayedNow.add(d.vehicle_id);
        else delayedNow.delete(d.vehicle_id);
      }
    } catch {
      // best-effort monitor; ignore transient DB/socket errors
    }
  };
  return setInterval(tick, intervalMs);
}
