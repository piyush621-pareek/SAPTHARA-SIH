import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized, validated runtime configuration.
 * Fails fast at boot if a required variable is missing.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required(
    "DATABASE_URL",
    "postgres://ner_admin:ner_secret_2026@localhost:5432/ner_logistics"
  ),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  aiServiceUrl: required("AI_SERVICE_URL", "http://localhost:9000"),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  jwtSecret: process.env.JWT_SECRET ?? "ner-dev-secret-change-in-prod",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  // Access tokens are short-lived; refresh tokens are long-lived + revocable.
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  refreshExpiresDays: Number(process.env.REFRESH_EXPIRES_DAYS ?? 7),
  socketAuthRequired: process.env.SOCKET_AUTH_REQUIRED === "true",

  // Outbound notifications (SMS / responder alerting). When SMS_WEBHOOK_URL is
  // set, distress alerts are POSTed there (plug in Twilio, an SMS aggregator,
  // or a control-room webhook); otherwise they are logged.
  smsWebhookUrl: process.env.SMS_WEBHOOK_URL ?? "",
  responderNumbers: (process.env.RESPONDER_NUMBERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // --- ISRO / NRSC geospatial feeds ---------------------------------------
  // Live calls require ISRO-issued tokens (register at the respective portals).
  // Without them the clients return a physically-plausible modelled fallback.
  isro: {
    // Bhuvan WMS (NRSC) — thematic layers incl. landslide susceptibility.
    bhuvanWmsUrl:
      process.env.BHUVAN_WMS_URL ?? "https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms",
    bhuvanToken: process.env.BHUVAN_TOKEN ?? "",
    bhuvanLandslideLayer:
      process.env.BHUVAN_LANDSLIDE_LAYER ?? "geographical_indication:LS_SUSCEPTIBILITY",
    // MOSDAC (SAC) — satellite meteorology (rainfall / soil moisture).
    mosdacBaseUrl: process.env.MOSDAC_BASE_URL ?? "https://mosdac.gov.in/apps/api",
    mosdacToken: process.env.MOSDAC_TOKEN ?? "",
    // CartoDEM (Cartosat-1 DEM via Bhuvan) — elevation → slope.
    cartodemUrl:
      process.env.CARTODEM_URL ?? "https://bhuvan-app1.nrsc.gov.in/api/dem",
    cartodemToken: process.env.CARTODEM_TOKEN ?? "",
    // Fail fast so the request falls back to the model in dead zones.
    timeoutMs: Number(process.env.ISRO_TIMEOUT_MS ?? 4000),
  },
} as const;

export const isProd = env.nodeEnv === "production";
