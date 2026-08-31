import { Request, Response } from "express";
import { recordEvent, getLedger, verifyLedger } from "../services/ledger.service";
import { AppendLedgerBody } from "../schemas/ledger.schema";
import { parsePage } from "../utils/pagination";

/** POST /api/v1/ledger — append an event to the chain (protected). */
export async function postEntry(req: Request, res: Response): Promise<void> {
  const { event_type, payload } = req.body as AppendLedgerBody;
  const entry = await recordEvent(event_type, payload);
  res.status(201).json({ success: true, data: entry });
}

/** GET /api/v1/ledger — most recent entries. */
export async function getEntries(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePage(req, 100);
  const entries = await getLedger(limit, offset);
  res.json({ success: true, count: entries.length, limit, offset, data: entries });
}

/** GET /api/v1/ledger/verify — proves the chain has not been tampered with. */
export async function getVerify(_req: Request, res: Response): Promise<void> {
  const result = await verifyLedger();
  res.status(result.valid ? 200 : 409).json({ success: result.valid, data: result });
}
