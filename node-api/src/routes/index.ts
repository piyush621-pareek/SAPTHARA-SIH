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
