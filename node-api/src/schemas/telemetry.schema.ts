import { z } from "zod";

/** A single edge-captured telemetry reading. */
export const telemetryPointSchema = z.object({
  vehicle_id: z.string().uuid(),
  trip_id: z.string().uuid().nullish(),
  timestamp: z
    .string()
    .datetime({ offset: true })
    .describe("ISO-8601 edge capture time"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed_kmph: z.number().min(0).max(400).nullish(),
  heading_deg: z.number().min(0).max(360).nullish(),
  altitude_m: z.number().nullish(),
  battery_pct: z.number().min(0).max(100).nullish(),
  source: z
    .enum(["internet", "sms_2g", "ble_mesh", "manual"])
    .default("internet"),
});

/** Bulk offline-sync payload: buffered points flushed when connectivity returns. */
export const batchTelemetrySchema = z.object({
  body: z.object({
    points: z
      .array(telemetryPointSchema)
      .min(1, "at least one point required")
      .max(5000, "batch capped at 5000 points"),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

/**
 * BLE mesh relay packet — a base64-encoded frame carrying a compact telemetry
 * record forwarded hop-by-hop from an offline node.
 */
export const relayTelemetrySchema = z.object({
  body: z.object({
    relay_id: z.string().min(1),
    hop_count: z.number().int().min(0).max(32).default(0),
    // base64 of JSON: { v: vehicle_id, t: iso, la: lat, ln: lng, s?: speed }
    packet: z.string().min(1, "base64 packet required"),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export type TelemetryPoint = z.infer<typeof telemetryPointSchema>;
export type BatchTelemetryBody = z.infer<typeof batchTelemetrySchema>["body"];
export type RelayTelemetryBody = z.infer<typeof relayTelemetrySchema>["body"];
