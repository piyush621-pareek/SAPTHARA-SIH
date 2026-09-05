import { Request, Response } from "express";
import {
  getEnvironmentalContext,
  getDataDrivenRisk,
  getBhuvanLayers,
} from "../services/geo.service";
import { getConnectivity, getDeliveries } from "../services/connectivity.service";
import { GeoPointQuery } from "../schemas/geo.schema";
import { geocodeVillage } from "../services/isro/bhuvan.geocode";

/** GET /api/v1/geo/context?lat=&lng= — fused MOSDAC + CartoDEM + Bhuvan data. */
export async function getContext(req: Request, res: Response): Promise<void> {
  const { lat, lng } = req.query as unknown as GeoPointQuery;
  const context = await getEnvironmentalContext(lat, lng);
  res.json({ success: true, data: context });
}

/** GET /api/v1/geo/risk?lat=&lng= — satellite-driven landslide risk. */
export async function getRisk(req: Request, res: Response): Promise<void> {
  const { lat, lng } = req.query as unknown as GeoPointQuery;
  const risk = await getDataDrivenRisk(lat, lng);
  res.json({ success: true, data: risk });
}

/** GET /api/v1/geo/layers — Bhuvan/CartoDEM WMS layer descriptors for maps. */
export async function getLayers(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: getBhuvanLayers() });
}

/**
 * GET /api/v1/geo/connectivity — district-wise connectivity status + live
 * delivery statuses (on_time / at_risk / delayed) with a summary.
 */
export async function getConnectivityStatus(_req: Request, res: Response): Promise<void> {
  const [districts, deliveries] = await Promise.all([getConnectivity(), getDeliveries()]);
  const summary = {
    total: deliveries.length,
    on_time: deliveries.filter((d) => d.status === "on_time").length,
    at_risk: deliveries.filter((d) => d.status === "at_risk").length,
    delayed: deliveries.filter((d) => d.status === "delayed").length,
  };
  const districtSummary = {
    open: districts.filter((d) => d.status === "open").length,
    at_risk: districts.filter((d) => d.status === "at_risk").length,
    blocked: districts.filter((d) => d.status === "blocked").length,
  };
  res.json({
    success: true,
    data: { districts, deliveries, summary, district_summary: districtSummary },
  });
}

/** GET /api/v1/geo/village?name=sekuru — Bhuvan village geocoding (census-linked). */
export async function getVillageGeocode(req: Request, res: Response): Promise<void> {
  const name = req.query.name as string | undefined;
  if (!name) {
    res.status(400).json({ success: false, error: "name query parameter required" });
    return;
  }
  const results = await geocodeVillage(name);
  res.json({ success: true, data: results });
}
