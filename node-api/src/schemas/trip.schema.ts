import { z } from "zod";

const point = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createTripSchema = z.object({
  body: z.object({
    vehicle_id: z.string().uuid(),
    driver_id: z.string().uuid().nullish(),
    origin: point,
    destination: point,
    // Optional planned route as an ordered list of [lng, lat] positions.
    planned_route: z
      .array(z.tuple([z.number(), z.number()]))
      .min(2)
      .nullish(),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export const tripIdSchema = z.object({
  body: z.object({}).passthrough().optional(),
  query: z.object({}).passthrough().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      "planned",
      "in_transit",
      "completed",
      "rerouted",
      "aborted",
    ]),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export type CreateTripBody = z.infer<typeof createTripSchema>["body"];
export type UpdateStatusBody = z.infer<typeof updateStatusSchema>["body"];
