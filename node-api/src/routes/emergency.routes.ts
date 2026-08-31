import { Router } from "express";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { smsEmergencySchema } from "../schemas/emergency.schema";
import { postSmsEmergency } from "../controllers/emergency.controller";

const router = Router();

// 2G SMS distress webhook (Tier-1 emergency fallback).
router.post("/sms", validate(smsEmergencySchema), asyncHandler(postSmsEmergency));

export default router;
