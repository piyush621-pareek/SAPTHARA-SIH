import { Request, Response } from "express";
import { computeRoute } from "../services/routing.service";
import { RouteBody } from "../schemas/routing.schema";
import { getBhuvanRoute } from "../services/isro/bhuvan.routing";

/** POST /api/v1/routing/route — hazard-aware shortest path. */
export async function postRoute(req: Request, res: Response): Promise<void> {
  const { origin, destination } = req.body as RouteBody;
  const route = await computeRoute(origin, destination);
  res.json({ success: true, data: route });
}

/** GET /api/v1/routing/bhuvan?lat1=&lon1=&lat2=&lon2= — Bhuvan road route (same-state). */
export async function getBhuvanRouteHandler(req: Request, res: Response): Promise<void> {
  const { lat1, lon1, lat2, lon2 } = req.query as Record<string, string>;
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    res.status(400).json({ success: false, error: "lat1, lon1, lat2, lon2 required" });
    return;
  }
  const route = await getBhuvanRoute(+lat1, +lon1, +lat2, +lon2);
  if (!route) {
    res.status(422).json({ success: false, error: "No Bhuvan route (points must be in the same state)" });
    return;
  }
  res.json({ success: true, data: route });
}
