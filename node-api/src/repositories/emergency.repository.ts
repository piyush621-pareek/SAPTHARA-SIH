import { query } from "../config/db";

export interface EmergencyIncidentRow {
  id: string;
  vehicle_id: string | null;
  channel: string;
  latitude: number;
  longitude: number;
  message: string | null;
  created_at: string;
}

export interface CreateIncidentInput {
  vehicleId: string | null;
  channel: "sms_2g" | "ble_mesh" | "internet" | "manual";
  latitude: number;
  longitude: number;
  rawPayload: string;
  message: string;
}

/**
 * Persists an emergency incident. If a vehicle_id is supplied but does not
 * exist, the FK is stored as NULL rather than failing the distress ingest —
 * an unrecognized distress signal must never be dropped.
 */
export async function createIncident(
  input: CreateIncidentInput
): Promise<EmergencyIncidentRow> {
  const { rows } = await query<EmergencyIncidentRow>(
    `INSERT INTO emergency_incidents
       (vehicle_id, channel, location, raw_payload, message)
     VALUES
       (
         (SELECT id FROM vehicles WHERE id = $1),
         $2,
         ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
         $5,
         $6
       )
     RETURNING
       id, vehicle_id, channel,
       ST_Y(location::geometry) AS latitude,
       ST_X(location::geometry) AS longitude,
       message, created_at`,
    [
      input.vehicleId,
      input.channel,
      input.longitude,
      input.latitude,
      input.rawPayload,
      input.message,
    ]
  );
  return rows[0];
}
