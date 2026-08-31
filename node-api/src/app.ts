import path from "path";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import apiRoutes from "./routes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { env, isProd } from "./config/env";

/**
 * Builds and configures the Express application (no listening here — that is
 * server.ts's job, so the app can be imported for tests in isolation).
 */
export function createApp(): Application {
  const app = express();

  // --- Security & platform middleware ---
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(compression());
  app.use(express.json({ limit: "5mb" })); // batch telemetry can be large
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(isProd ? "combined" : "dev"));

  // Static hosting for the downloadable APK (in-app self-update). Drop the
  // release build at node-api/public/saptahara.apk -> served at /downloads/.
  app.use("/downloads", express.static(path.join(process.cwd(), "public")));

  // --- Rate limiting ---
  // Global cap protects the API; telemetry ingest is high-volume from many
  // edge devices, so it gets a much higher ceiling than interactive routes.
  const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const telemetryLimiter = rateLimit({ windowMs: 60_000, max: 6000 });
  app.use("/api/v1/telemetry", telemetryLimiter);
  app.use("/api/v1", globalLimiter);

  // --- Liveness root ---
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      success: true,
      service: "AI Smart Logistics Platform — NER (SIH26002)",
      version: "1.0.0",
    });
  });

  // --- Versioned API ---
  app.use("/api/v1", apiRoutes);

  // --- 404 then centralized error handler (must be LAST) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
