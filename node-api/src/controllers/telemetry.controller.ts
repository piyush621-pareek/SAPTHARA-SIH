import { Request, Response } from "express";
import { ingestBatch, ingestRelay } from "../services/telemetry.service";
import { BatchTelemetryBody, RelayTelemetryBody } from "../schemas/telemetry.schema";

/** POST /api/v1/telemetry/batch */
export async function postBatch(req: Request, res: Response): Promise<void> {
  const body = req.body as BatchTelemetryBody;
  const result = await ingestBatch(body.points);
  res.status(201).json({ success: true, data: result });
}

/** POST /api/v1/telemetry/relay */
export async function postRelay(req: Request, res: Response): Promise<void> {
  const body = req.body as RelayTelemetryBody;
  const result = await ingestRelay(body);
  res.status(202).json({ success: true, data: result });
}
