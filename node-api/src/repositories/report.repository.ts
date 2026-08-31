import { query } from "../config/db";

export interface ReportRow {
  id: string;
  report_type: string;
  notes: string | null;
  urgency: string;
  media_ids: string[];
  latitude: number;
  longitude: number;
  ledger_seq: number | null;
  ledger_hash: string | null;
  created_at: string;
}

export interface CreateReportInput {
  reportType: string;
  notes: string;
  urgency: string;
  mediaIds: string[];
  latitude: number;
  longitude: number;
}

export async function insertReport(input: CreateReportInput): Promise<ReportRow> {
  const { rows } = await query<ReportRow>(
    `INSERT INTO field_reports
       (report_type, notes, urgency, media_ids, location)
     VALUES
       ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)
     RETURNING
       id, report_type, notes, urgency, media_ids,
       ST_Y(location::geometry) AS latitude,
       ST_X(location::geometry) AS longitude,
       ledger_seq, ledger_hash, created_at`,
    [
      input.reportType,
      input.notes,
      input.urgency,
      input.mediaIds,
      input.longitude,
      input.latitude,
    ]
  );
  return rows[0];
}

/** Stamps the report with its audit-ledger link after it is chained. */
export async function attachLedger(
  id: string,
  seq: number,
  hash: string
): Promise<void> {
  await query(
    `UPDATE field_reports SET ledger_seq = $2, ledger_hash = $3 WHERE id = $1`,
    [id, seq, hash]
  );
}

export async function getReport(id: string): Promise<ReportRow | null> {
  const { rows } = await query<ReportRow>(
    `SELECT id, report_type, notes, urgency, media_ids,
            ST_Y(location::geometry) AS latitude,
            ST_X(location::geometry) AS longitude,
            ledger_seq, ledger_hash, created_at
       FROM field_reports WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listReports(limit = 100, offset = 0): Promise<ReportRow[]> {
  const { rows } = await query<ReportRow>(
    `SELECT id, report_type, notes, urgency, media_ids,
            ST_Y(location::geometry) AS latitude,
            ST_X(location::geometry) AS longitude,
            ledger_seq, ledger_hash, created_at
       FROM field_reports ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}
