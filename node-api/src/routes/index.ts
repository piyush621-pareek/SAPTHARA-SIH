import { Router, Request, Response } from "express";
import telemetryRoutes from "./telemetry.routes";
import hazardRoutes from "./hazard.routes";
import emergencyRoutes from "./emergency.routes";
import fleetRoutes from "./fleet.routes";
import authRoutes from "./auth.routes";
import tripRoutes from "./trip.routes";
import ledgerRoutes from "./ledger.routes";
import geoRoutes from "./geo.routes";
import routingRoutes from "./routing.routes";
import reportRoutes from "./report.routes";
import adminRoutes from "./admin.routes";

const api = Router();

api.get("/health", (_req: Request, res: Response) => {
  res.json({ success: true, service: "ner-node-api", status: "ok", ts: Date.now() });
});

/**
 * App update check. The mobile app calls this on launch and compares `version`
 * to its own; if newer, it prompts the user to download the APK from `apk_url`.
 * Bump APP_VERSION and drop a new saptahara.apk into node-api/public to publish.
 */
api.get("/app/version", (req: Request, res: Response) => {
  const base = `${req.protocol}://${req.get("host")}`;
  res.json({
    success: true,
    data: {
      version: process.env.APP_VERSION || "1.0.0",
      apk_url: `${base}/downloads/saptahara.apk`,
      notes: process.env.APP_RELEASE_NOTES || "Latest SAPTHARA build.",
      mandatory: (process.env.APP_UPDATE_MANDATORY || "false") === "true",
    },
  });
});

api.use("/auth", authRoutes);
api.use("/telemetry", telemetryRoutes);
api.use("/hazards", hazardRoutes);
api.use("/emergency", emergencyRoutes);
api.use("/fleet", fleetRoutes);
api.use("/trips", tripRoutes);
api.use("/ledger", ledgerRoutes);
api.use("/geo", geoRoutes);
api.use("/routing", routingRoutes);
api.use("/reports", reportRoutes);
api.use("/admin", adminRoutes);

export default api;
