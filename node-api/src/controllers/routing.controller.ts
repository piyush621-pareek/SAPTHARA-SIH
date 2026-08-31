import { Request, Response } from "express";
import { computeRoute } from "../services/routing.service";
import { RouteBody } from "../schemas/routing.schema";

/** POST /api/v1/routing/route — hazard-aware shortest path. */
export async function postRoute(req: Request, res: Response): Promise<void> {
  const { origin, destination } = req.body as RouteBody;
  const route = await computeRoute(origin, destination);
  res.json({ success: true, data: route });
}
