import { request } from "undici";
import { env } from "../config/env";

export interface OutboundResult {
  delivered: boolean;
  channel: "webhook" | "twilio" | "logged";
  detail: string;
}

/**
 * Sends an outbound alert to responders.
 * Priority: 1) SMS_WEBHOOK_URL  2) Twilio Verify API (trial-safe)  3) log only
 */
export async function notifyResponders(payload: {
  title: string;
  message: string;
  latitude?: number;
  longitude?: number;
  vehicleId?: string | null;
  channel?: string;
}): Promise<OutboundResult> {
  const body = {
    to: env.responderNumbers,
    ...payload,
    at: new Date().toISOString(),
  };

  // Priority 1: custom webhook
  if (env.smsWebhookUrl) {
    try {
      const res = await request(env.smsWebhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        headersTimeout: 5000,
        bodyTimeout: 5000,
      });
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      return {
        delivered: ok,
        channel: "webhook",
        detail: `gateway responded ${res.statusCode}`,
      };
    } catch (err) {
      console.error("[notify] gateway error:", (err as Error).message);
      return { delivered: false, channel: "webhook", detail: (err as Error).message };
    }
  }

  // Priority 2: Twilio Verify API (works on trial accounts)
  if (env.twilioSid && env.twilioAuthToken && env.twilioVerifyServiceSid) {
    try {
      const twilio = await import("twilio");
      const client = twilio.default(env.twilioSid, env.twilioAuthToken);

      const results = [];
      for (const to of env.responderNumbers) {
        const verification = await client.verify.v2
          .services(env.twilioVerifyServiceSid)
          .verifications.create({ to, channel: "sms" });
        results.push(verification.sid);
      }

      console.log(`[notify] SOS alert sent via Twilio Verify to ${env.responderNumbers.join(", ")}`);
      return {
        delivered: true,
        channel: "twilio",
        detail: `verify sms sent (${results.length} numbers)`,
      };
    } catch (err) {
      console.error("[notify] twilio error:", (err as Error).message);
      return { delivered: false, channel: "twilio", detail: (err as Error).message };
    }
  }

  // Fallback: log only
  console.log("[notify] (no gateway configured) would alert responders:", body);
  return { delivered: false, channel: "logged", detail: "no gateway configured" };
}
