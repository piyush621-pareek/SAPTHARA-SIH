import { Request, Response } from "express";
import {
  startTrip,
  listAllTrips,
  getTripOrThrow,
  changeTripStatus,
  getTripWithTrack,
} from "../services/trip.service";
import { CreateTripBody, UpdateStatusBody } from "../schemas/trip.schema";
import { parsePage } from "../utils/pagination";

/** POST /api/v1/trips */
export async function postTrip(req: Request, res: Response): Promise<void> {
  const trip = await startTrip(req.body as CreateTripBody);
  res.status(201).json({ success: true, data: trip });
}

/** GET /api/v1/trips */
export async function getTrips(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePage(req);
  const trips = await listAllTrips(limit, offset);
  res.json({ success: true, count: trips.length, limit, offset, data: trips });
}

/** GET /api/v1/trips/:id */
export async function getTripById(req: Request, res: Response): Promise<void> {
  const trip = await getTripOrThrow(req.params.id);
  res.json({ success: true, data: trip });
}

/** GET /api/v1/trips/:id/track — trip + telemetry breadcrumb. */
export async function getTripTrackById(
  req: Request,
  res: Response
): Promise<void> {
  const result = await getTripWithTrack(req.params.id);
  res.json({ success: true, data: result });
}

/** PATCH /api/v1/trips/:id/status */
export async function patchTripStatus(
  req: Request,
  res: Response
): Promise<void> {
  const { status } = req.body as UpdateStatusBody;
  const trip = await changeTripStatus(req.params.id, status);
  res.json({ success: true, data: trip });
}
