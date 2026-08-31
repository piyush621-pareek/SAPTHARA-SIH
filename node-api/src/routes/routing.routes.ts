import { Router } from "express";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { routeSchema } from "../schemas/routing.schema";
import { postRoute } from "../controllers/routing.controller";

const router = Router();

router.post("/route", validate(routeSchema), asyncHandler(postRoute));

export default router;
