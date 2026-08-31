import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { getFleet } from "../controllers/fleet.controller";

const router = Router();

router.get("/", asyncHandler(getFleet));

export default router;
