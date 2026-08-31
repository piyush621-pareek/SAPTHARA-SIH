import { z } from "zod";

export const appendLedgerSchema = z.object({
  body: z.object({
    event_type: z.string().min(1).max(120),
    payload: z.record(z.string(), z.unknown()).default({}),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export type AppendLedgerBody = z.infer<typeof appendLedgerSchema>["body"];
