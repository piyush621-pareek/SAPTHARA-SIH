import { Request, Response } from "express";
import {
  createReport,
  getReportOrThrow,
  listAllReports,
} from "../services/report.service";
import { CreateReportBody } from "../schemas/report.schema";
import { parsePage } from "../utils/pagination";

/** POST /api/v1/reports — sync an offline field report (anchors to ledger). */
export async function postReport(req: Request, res: Response): Promise<void> {
  const b = req.body as CreateReportBody;
  const report = await createReport({
    reportType: b.report_type,
    notes: b.notes,
    urgency: b.urgency,
    mediaIds: b.media_ids,
    latitude: b.latitude,
    longitude: b.longitude,
  });
  res.status(201).json({ success: true, data: report });
}

/** GET /api/v1/reports */
export async function getReports(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePage(req, 100);
  const reports = await listAllReports(limit, offset);
  res.json({ success: true, count: reports.length, limit, offset, data: reports });
}

/** GET /api/v1/reports/:id — includes the ledger hash (verification receipt). */
export async function getReportById(req: Request, res: Response): Promise<void> {
  const report = await getReportOrThrow(req.params.id);
  res.json({ success: true, data: report });
}
