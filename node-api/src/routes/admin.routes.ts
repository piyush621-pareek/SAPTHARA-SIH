import { Router } from "express";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { asyncHandler } from "../utils/asyncHandler";
import {
  updateUserSchema,
  createVehicleSchema,
  updateVehicleSchema,
  idParamSchema,
} from "../schemas/admin.schema";
import {
  getUsers,
  patchUser,
  removeUser,
  postVehicle,
  getVehicles,
  patchVehicle,
  removeVehicle,
} from "../controllers/admin.controller";

const router = Router();

// Every admin route requires a valid JWT with the "admin" role.
router.use(requireAuth, requireRole("admin"));

// Users
router.get("/users", asyncHandler(getUsers));
router.patch("/users/:id", validate(updateUserSchema), asyncHandler(patchUser));
router.delete("/users/:id", validate(idParamSchema), asyncHandler(removeUser));

// Vehicles
router.get("/vehicles", asyncHandler(getVehicles));
router.post("/vehicles", validate(createVehicleSchema), asyncHandler(postVehicle));
router.patch("/vehicles/:id", validate(updateVehicleSchema), asyncHandler(patchVehicle));
router.delete("/vehicles/:id", validate(idParamSchema), asyncHandler(removeVehicle));

export default router;
