import { createIncident } from "../repositories/emergency.repository";
import { findContainingHazards } from "../repositories/hazard.repository";
import { SmsEmergencyBody } from "../schemas/emergency.schema";
import { emitAlert } from "../config/socket";
import { AppError } from "../utils/AppError";
import { recordEvent } from "./ledger.service";
import { notifyResponders } from "./notification.service";

interface DecodedDistress {
  vehicleId: string | null;
  latitude: number;
  longitude: number;
  message: string;
}

/**
 * Decodes a base64 distress payload. Supports two compact wire formats so a 2G
 * SMS gateway can send whichever is cheaper:
 *   1) pipe frame : "vehicleId|lat|lng[|message]"
 *   2) JSON frame : {"v":"...","la":25.5,"ln":91.8,"m":"..."}
 */
export function decodeDistress(payloadB64: string): DecodedDistress {
  let raw: string;
  try {
    raw = Buffer.from(payloadB64, "base64").toString("utf8").trim();
  } catch {
    throw AppError.badRequest("payload is not valid base64");
  }
  if (!raw) throw AppError.badRequest("decoded payload is empty");

  // JSON frame
  if (raw.startsWith("{")) {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const lat = Number(o.la ?? o.lat ?? o.latitude);
      const lng = Number(o.ln ?? o.lng ?? o.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error("bad coords");
      }
      return {
        vehicleId: o.v ? String(o.v) : o.vehicleId ? String(o.vehicleId) : null,
        latitude: lat,
        longitude: lng,
        message: o.m ? String(o.m) : "SOS distress signal (SMS/2G)",
      };
    } catch {
      throw AppError.unprocessable("distress JSON frame is malformed");
    }
  }

  // Pipe frame
  const parts = raw.split("|");
  if (parts.length < 3) {
    throw AppError.unprocessable(
      'distress frame must be "vehicleId|lat|lng[|message]"'
    );
  }
  const [vehicleId, latStr, lngStr, ...msgParts] = parts;
  const latitude = Number(latStr);
  const longitude = Number(lngStr);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw AppError.unprocessable("distress frame has non-numeric coordinates");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw AppError.unprocessable("distress coordinates out of range");
  }
  return {
    vehicleId: vehicleId || null,
    latitude,
    longitude,
    message: msgParts.length ? msgParts.join("|") : "SOS distress signal (SMS/2G)",
  };
}

/**
 * Handles the 2G SMS emergency webhook: decode -> persist -> real-time push.
 * Enriches the alert with any hazard polygon the distress point sits inside.
 */
export async function handleSmsEmergency(body: SmsEmergencyBody): Promise<{
  incidentId: string;
  vehicleId: string | null;
  location: { latitude: number; longitude: number };
  insideHazards: string[];
}> {
  const distress = decodeDistress(body.payload);

  const incident = await createIncident({
    vehicleId: distress.vehicleId,
    channel: "sms_2g",
    latitude: distress.latitude,
    longitude: distress.longitude,
    rawPayload: body.payload,
    message: distress.message,
  });

  // Append an immutable audit record of this distress signal. Guarded so a
  // ledger hiccup can never block emergency delivery.
  try {
    await recordEvent("emergency.sos", {
      incidentId: incident.id,
      vehicleId: distress.vehicleId,
      channel: "sms_2g",
      latitude: distress.latitude,
      longitude: distress.longitude,
      message: distress.message,
      receivedAt: incident.created_at,
    });
  } catch {
    // non-fatal
  }

  const containing = await findContainingHazards(
    distress.latitude,
    distress.longitude
  );

  const alertPayload = {
    incidentId: incident.id,
    vehicleId: distress.vehicleId,
    channel: "sms_2g" as const,
    message: distress.message,
    sender: body.sender ?? null,
    location: { latitude: distress.latitude, longitude: distress.longitude },
    insideHazards: containing,
    at: incident.created_at,
  };

  // Broadcast to all dispatchers; emergency alerts are never region-scoped.
  emitAlert("emergency:alert", alertPayload);

  // Fan out to responders over the configured outbound gateway (non-blocking).
  void notifyResponders({
    title: "SOS distress signal",
    message: distress.message,
    latitude: distress.latitude,
    longitude: distress.longitude,
    vehicleId: distress.vehicleId,
    channel: "sms_2g",
  });

  return {
    incidentId: incident.id,
    vehicleId: distress.vehicleId,
    location: { latitude: distress.latitude, longitude: distress.longitude },
    insideHazards: containing.map((h) => h.label),
  };
}
