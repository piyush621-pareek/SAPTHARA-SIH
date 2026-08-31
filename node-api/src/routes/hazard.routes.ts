import { Router } from "express";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createHazardSchema,
  nearbyHazardSchema,
  containmentSchema,
  riskAssessmentSchema,
} from "../schemas/hazard.schema";
import {
  postHazard,
  getNearby,
  getAll,
  postContains,
  postRisk,
} from "../controllers/hazard.controller";

const router = Router();

router.get("/", asyncHandler(getAll));
router.post("/", validate(createHazardSchema), asyncHandler(postHazard));
router.get("/nearby", validate(nearbyHazardSchema), asyncHandler(getNearby));
router.post("/contains", validate(containmentSchema), asyncHandler(postContains));
router.post("/risk", validate(riskAssessmentSchema), asyncHandler(postRisk));

export default router;
