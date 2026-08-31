import { Request, Response } from "express";
import {
  registerHazard,
  getNearbyHazards,
  checkContainment,
  assessRouteRisk,
  getAllHazards,
} from "../services/hazard.service";
import {
  CreateHazardBody,
  NearbyHazardQuery,
  ContainmentBody,
} from "../schemas/hazard.schema";
import { parsePage } from "../utils/pagination";

/** POST /api/v1/hazards */
export async function postHazard(req: Request, res: Response): Promise<void> {
  const hazard = await registerHazard(req.body as CreateHazardBody);
  res.status(201).json({ success: true, data: hazard });
}

/** GET /api/v1/hazards — all active hazards as GeoJSON (dashboard map). */
export async function getAll(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePage(req, 200);
  const hazards = await getAllHazards(limit, offset);
  res.json({ success: true, count: hazards.length, limit, offset, data: hazards });
}

/** GET /api/v1/hazards/nearby?lat=&lng=&radius_m= */
export async function getNearby(req: Request, res: Response): Promise<void> {
  const { lat, lng, radius_m } = req.query as unknown as NearbyHazardQuery;
  const hazards = await getNearbyHazards(lat, lng, radius_m);
  res.json({ success: true, count: hazards.length, data: hazards });
}

/** POST /api/v1/hazards/contains */
export async function postContains(req: Request, res: Response): Promise<void> {
  const { latitude, longitude } = req.body as ContainmentBody;
  const result = await checkContainment(latitude, longitude);
  res.json({ success: true, data: result });
}

/** POST /api/v1/hazards/risk — predictive rerouting risk assessment. */
export async function postRisk(req: Request, res: Response): Promise<void> {
  const result = await assessRouteRisk(req.body);
  res.json({ success: true, data: result });
}
