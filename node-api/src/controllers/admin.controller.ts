import { Request, Response } from "express";
import {
  listUsers,
  updateUser,
  deleteUser,
} from "../repositories/user.repository";
import {
  createVehicle,
  listVehicles,
  updateVehicle,
  deleteVehicle,
} from "../repositories/vehicle.repository";
import { parsePage } from "../utils/pagination";
import { AppError } from "../utils/AppError";

// ---- Users ----------------------------------------------------------------
export async function getUsers(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePage(req);
  const users = await listUsers(limit, offset);
  res.json({ success: true, count: users.length, limit, offset, data: users });
}

export async function patchUser(req: Request, res: Response): Promise<void> {
  const updated = await updateUser(req.params.id, {
    role: req.body.role,
    home_state: req.body.home_state,
    full_name: req.body.full_name,
  });
  if (!updated) throw AppError.notFound("User not found");
  res.json({ success: true, data: updated });
}

export async function removeUser(req: Request, res: Response): Promise<void> {
  const ok = await deleteUser(req.params.id);
  if (!ok) throw AppError.notFound("User not found");
  res.json({ success: true });
}

// ---- Vehicles -------------------------------------------------------------
export async function postVehicle(req: Request, res: Response): Promise<void> {
  const v = await createVehicle({
    registration: req.body.registration,
    model: req.body.model ?? null,
    capacityKg: req.body.capacity_kg ?? null,
    ownerId: req.body.owner_id ?? null,
  });
  res.status(201).json({ success: true, data: v });
}

export async function getVehicles(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePage(req);
  const vehicles = await listVehicles(limit, offset);
  res.json({ success: true, count: vehicles.length, limit, offset, data: vehicles });
}

export async function patchVehicle(req: Request, res: Response): Promise<void> {
  const updated = await updateVehicle(req.params.id, {
    registration: req.body.registration,
    model: req.body.model,
    capacityKg: req.body.capacity_kg,
    status: req.body.status,
  });
  if (!updated) throw AppError.notFound("Vehicle not found");
  res.json({ success: true, data: updated });
}

export async function removeVehicle(req: Request, res: Response): Promise<void> {
  const ok = await deleteVehicle(req.params.id);
  if (!ok) throw AppError.notFound("Vehicle not found");
  res.json({ success: true });
}
