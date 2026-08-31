import { z } from "zod";

/** Shared lat/lng query for the geo endpoints. */
export const geoPointSchema = z.object({
  body: z.object({}).passthrough().optional(),
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  }),
  params: z.object({}).passthrough().optional(),
});

export type GeoPointQuery = z.infer<typeof geoPointSchema>["query"];
