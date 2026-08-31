import { z } from "zod";

/**
 * 2G SMS emergency webhook. A gateway (e.g. an SMS aggregator) posts the raw
 * base64-encoded body of an inbound distress SMS. The encoded payload decodes
 * to "vehicleId|lat|lng" or a JSON blob; both forms are handled in the service.
 */
export const smsEmergencySchema = z.object({
  body: z.object({
    // base64 of "vehicleId|lat|lng" (compact 2G-friendly frame)
    payload: z.string().min(1, "base64 payload required"),
    sender: z.string().optional(),
    received_at: z.string().datetime({ offset: true }).optional(),
  }),
  query: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough().optional(),
});

export type SmsEmergencyBody = z.infer<typeof smsEmergencySchema>["body"];
