import { Router } from "express";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createTripSchema,
  tripIdSchema,
  updateStatusSchema,
} from "../schemas/trip.schema";
import {
  postTrip,
  getTrips,
  getTripById,
  getTripTrackById,
  patchTripStatus,
} from "../controllers/trip.controller";

const router = Router();

// All trip routes require a valid JWT (dispatcher/driver operations).
router.use(requireAuth);

router.post("/", validate(createTripSchema), asyncHandler(postTrip));
router.get("/", asyncHandler(getTrips));
router.get("/:id", validate(tripIdSchema), asyncHandler(getTripById));
router.get("/:id/track", validate(tripIdSchema), asyncHandler(getTripTrackById));
router.patch(
  "/:id/status",
  validate(updateStatusSchema),
  asyncHandler(patchTripStatus)
);

export default router;
