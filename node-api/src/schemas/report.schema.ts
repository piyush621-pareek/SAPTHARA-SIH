import { z } from "zod";

export const createReportSchema = z.object({
  body: z.object({
    report_type: z.enum([
      "landslide",
      "flood",
      "roadblock",
      "supply_issue",
      "other",
    ]),
    notes: z.string().max(2000).default(""),
    urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    media_ids: z.array(z.string()).default([]),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export const reportIdSchema = z.object({
  body: z.object({}).passthrough().optional(),
  query: z.object({}).passthrough().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export type CreateReportBody = z.infer<typeof createReportSchema>["body"];
