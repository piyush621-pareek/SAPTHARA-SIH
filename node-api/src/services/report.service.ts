import {
  insertReport,
  attachLedger,
  getReport,
  listReports,
  ReportRow,
  CreateReportInput,
} from "../repositories/report.repository";
import { recordEvent } from "./ledger.service";
import { AppError } from "../utils/AppError";

/**
 * Creates a field report and anchors it to the tamper-evident ledger, so it
 * gets an immutable verification receipt (hash). This backs the frontend's
 * offline-sync + blockchain-style verification flow.
 */
export async function createReport(input: CreateReportInput): Promise<ReportRow> {
  const report = await insertReport(input);
  try {
    const entry = await recordEvent("field.report", {
      reportId: report.id,
      type: report.report_type,
      urgency: report.urgency,
      latitude: report.latitude,
      longitude: report.longitude,
      createdAt: report.created_at,
    });
    await attachLedger(report.id, Number(entry.seq), entry.hash);
    report.ledger_seq = Number(entry.seq);
    report.ledger_hash = entry.hash;
  } catch {
    // Ledger anchoring is best-effort; the report is still saved.
  }
  return report;
}

export async function getReportOrThrow(id: string): Promise<ReportRow> {
  const r = await getReport(id);
  if (!r) throw AppError.notFound(`Report ${id} not found`);
  return r;
}

export async function listAllReports(limit?: number, offset?: number): Promise<ReportRow[]> {
  return listReports(limit, offset);
}
