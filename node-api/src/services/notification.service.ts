import { request } from "undici";
import { env } from "../config/env";

export interface OutboundResult {
  delivered: boolean;
  channel: "webhook" | "logged";
  detail: string;
}

/**
 * Sends an outbound alert to responders. If SMS_WEBHOOK_URL is configured the
 * message is POSTed there (wire in Twilio / an SMS aggregator / a control-room
 * webhook); otherwise it is logged so the flow is observable in development.
 * Never throws — notification failure must not break the caller.
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

  if (!env.smsWebhookUrl) {
    // eslint-disable-next-line no-console
    console.log("[notify] (no gateway configured) would alert responders:", body);
    return { delivered: false, channel: "logged", detail: "no gateway configured" };
  }

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
    // eslint-disable-next-line no-console
    console.error("[notify] gateway error:", (err as Error).message);
    return { delivered: false, channel: "webhook", detail: (err as Error).message };
  }
}
