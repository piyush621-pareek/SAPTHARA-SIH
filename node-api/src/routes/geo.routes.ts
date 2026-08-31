import { Router } from "express";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { geoPointSchema } from "../schemas/geo.schema";
import {
  getContext,
  getRisk,
  getLayers,
  getConnectivityStatus,
} from "../controllers/geo.controller";

const router = Router();

router.get("/context", validate(geoPointSchema), asyncHandler(getContext));
router.get("/risk", validate(geoPointSchema), asyncHandler(getRisk));
router.get("/layers", asyncHandler(getLayers));
router.get("/connectivity", asyncHandler(getConnectivityStatus));

export default router;
