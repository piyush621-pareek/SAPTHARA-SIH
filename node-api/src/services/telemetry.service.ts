import {
  bulkInsertTelemetry,
  insertRelayPoint,
} from "../repositories/telemetry.repository";
import { findContainingHazards } from "../repositories/hazard.repository";
import { TelemetryPoint, RelayTelemetryBody } from "../schemas/telemetry.schema";
import { emitAlert } from "../config/socket";
import { AppError } from "../utils/AppError";

export interface BatchIngestResult {
  received: number;
  inserted: number;
  duplicatesSkipped: number;
  geofenceBreaches: Array<{ vehicle_id: string; hazards: string[] }>;
}

/**
 * Handles POST /telemetry/batch — the resilient offline bulk sync.
 * Relies on the DB compound unique constraint for deduplication, then runs a
 * geofence pass over the freshly-ingested points and pushes breach alerts.
 */
export async function ingestBatch(
  points: TelemetryPoint[]
): Promise<BatchIngestResult> {
  const inserted = await bulkInsertTelemetry(points);

  // Broadcast the latest position per vehicle so the command dashboard can
  // animate the fleet live over Socket.IO.
  emitFleetUpdate(points);
  const insertedKeys = new Set(
    inserted.map((r) => `${r.vehicle_id}::${new Date(r.timestamp).toISOString()}`)
  );

  // Only evaluate geofences for points that were actually new to avoid
  // re-alerting on re-synced historical data.
  const freshPoints = points.filter((p) =>
    insertedKeys.has(`${p.vehicle_id}::${new Date(p.timestamp).toISOString()}`)
  );

  const geofenceBreaches = await detectGeofenceBreaches(freshPoints);

  return {
    received: points.length,
    inserted: inserted.length,
    duplicatesSkipped: points.length - inserted.length,
    geofenceBreaches,
  };
}

/**
 * Emits `fleet:update` with the newest position per vehicle in this batch.
 * Deduped so one batch produces one marker move per vehicle.
 */
function emitFleetUpdate(points: TelemetryPoint[]): void {
  const latestByVehicle = new Map<string, TelemetryPoint>();
  for (const p of points) {
    const prev = latestByVehicle.get(p.vehicle_id);
    if (!prev || new Date(p.timestamp) > new Date(prev.timestamp)) {
      latestByVehicle.set(p.vehicle_id, p);
    }
  }
  const positions = Array.from(latestByVehicle.values()).map((p) => ({
    vehicleId: p.vehicle_id,
    latitude: p.latitude,
    longitude: p.longitude,
    speedKmph: p.speed_kmph ?? null,
    headingDeg: p.heading_deg ?? null,
    at: p.timestamp,
  }));
  if (positions.length > 0) emitAlert("fleet:update", { positions });
}

/**
 * For each fresh point, checks whether it falls inside an active hazard polygon
 * (ST_Contains). On a breach, emits a real-time `hazard:breach` alert.
 * Deduped per vehicle so one moving truck doesn't spam identical alerts.
 */
async function detectGeofenceBreaches(
  points: TelemetryPoint[]
): Promise<Array<{ vehicle_id: string; hazards: string[] }>> {
  const breaches: Array<{ vehicle_id: string; hazards: string[] }> = [];
  const alertedVehicles = new Set<string>();

  for (const p of points) {
    if (alertedVehicles.has(p.vehicle_id)) continue;
    const hazards = await findContainingHazards(p.latitude, p.longitude);
    if (hazards.length > 0) {
      alertedVehicles.add(p.vehicle_id);
      const labels = hazards.map((h) => h.label);
      breaches.push({ vehicle_id: p.vehicle_id, hazards: labels });
      emitAlert("hazard:breach", {
        vehicleId: p.vehicle_id,
        at: p.timestamp,
        location: { latitude: p.latitude, longitude: p.longitude },
        hazards,
      });
    }
  }
  return breaches;
}

/**
 * Handles POST /telemetry/relay — a BLE mesh packet.
 * Decodes the base64 frame (JSON: { v, t, la, ln, s? }), persists the point
 * (dedup-safe), and returns whether it was newly stored.
 */
export async function ingestRelay(
  body: RelayTelemetryBody
): Promise<{ relayId: string; hopCount: number; stored: boolean }> {
  let decoded: unknown;
  try {
    const json = Buffer.from(body.packet, "base64").toString("utf8");
    decoded = JSON.parse(json);
  } catch {
    throw AppError.badRequest("relay packet is not valid base64-encoded JSON");
  }

  const frame = decoded as Record<string, unknown>;
  const vehicleId = String(frame.v ?? "");
  const timestamp = String(frame.t ?? "");
  const lat = Number(frame.la);
  const lng = Number(frame.ln);

  if (!vehicleId || !timestamp || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw AppError.unprocessable("relay frame missing v/t/la/ln fields");
  }

  const point: TelemetryPoint = {
    vehicle_id: vehicleId,
    trip_id: null,
    timestamp,
    latitude: lat,
    longitude: lng,
    speed_kmph: frame.s !== undefined ? Number(frame.s) : null,
    heading_deg: null,
    altitude_m: null,
    battery_pct: null,
    source: "ble_mesh",
  };

  const stored = await insertRelayPoint(point);

  // A relayed point that lands inside a hazard is still worth alerting on.
  if (stored) {
    const hazards = await findContainingHazards(lat, lng);
    if (hazards.length > 0) {
      emitAlert("hazard:breach", {
        vehicleId,
        at: timestamp,
        via: "ble_mesh",
        location: { latitude: lat, longitude: lng },
        hazards,
      });
    }
  }

  return { relayId: body.relay_id, hopCount: body.hop_count, stored };
}
