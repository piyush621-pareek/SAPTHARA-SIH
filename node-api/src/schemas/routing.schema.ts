import { z } from "zod";

const point = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const routeSchema = z.object({
  body: z.object({
    origin: point,
    destination: point,
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export type RouteBody = z.infer<typeof routeSchema>["body"];
