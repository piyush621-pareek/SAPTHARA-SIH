import { z } from "zod";

/** GeoJSON-ish [lng, lat] ring for a polygon (first == last enforced in service). */
const linearRing = z
  .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
  .min(4, "a polygon ring needs at least 4 positions");

export const createHazardSchema = z.object({
  body: z.object({
    label: z.string().min(1),
    kind: z
      .enum(["landslide", "flood", "roadblock", "bridge_failure", "checkpoint"])
      .default("landslide"),
    severity: z.number().int().min(1).max(5).default(1),
    risk_score: z.number().min(0).max(1).default(0),
    // Outer ring of the affected-area polygon.
    ring: linearRing,
    expires_at: z.string().datetime({ offset: true }).nullish(),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

/** Query nearby hazards within a radius (metres) of a point. */
export const nearbyHazardSchema = z.object({
  body: z.object({}).passthrough().optional(),
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius_m: z.coerce.number().min(1).max(200_000).default(5000),
  }),
  params: z.object({}).passthrough().optional(),
});

/** Geofence collision check — is a coordinate inside any active hazard polygon? */
export const containmentSchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

/** Predictive-rerouting risk assessment inputs (forwarded to the AI service). */
export const riskAssessmentSchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    rainfall_mm: z.number().min(0).max(2000).default(0),
    soil_moisture: z.number().min(0).max(1).default(0),
    slope: z.number().min(0).max(90).default(0),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export type CreateHazardBody = z.infer<typeof createHazardSchema>["body"];
export type RiskAssessmentBody = z.infer<typeof riskAssessmentSchema>["body"];
export type NearbyHazardQuery = z.infer<typeof nearbyHazardSchema>["query"];
export type ContainmentBody = z.infer<typeof containmentSchema>["body"];
