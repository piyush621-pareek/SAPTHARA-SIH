import { Router } from "express";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  batchTelemetrySchema,
  relayTelemetrySchema,
} from "../schemas/telemetry.schema";
import { postBatch, postRelay } from "../controllers/telemetry.controller";

const router = Router();

// Resilient offline bulk sync (native DB dedup).
router.post("/batch", validate(batchTelemetrySchema), asyncHandler(postBatch));

// BLE mesh relay packet ingest.
router.post("/relay", validate(relayTelemetrySchema), asyncHandler(postRelay));

export default router;
