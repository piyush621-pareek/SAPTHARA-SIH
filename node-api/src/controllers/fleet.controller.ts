import { Request, Response } from "express";
import { listFleet } from "../repositories/fleet.repository";
import { parsePage } from "../utils/pagination";

/** GET /api/v1/fleet — vehicles with last-known position (dashboard bootstrap). */
export async function getFleet(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePage(req, 200);
  const fleet = await listFleet(limit, offset);
  res.json({ success: true, count: fleet.length, limit, offset, data: fleet });
}
