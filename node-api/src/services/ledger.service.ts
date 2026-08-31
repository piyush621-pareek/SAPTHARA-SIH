import {
  appendEntry,
  listEntries,
  allEntriesAscending,
  LedgerRow,
} from "../repositories/ledger.repository";
import { verifyChain, ChainVerification } from "../utils/hashChain";

/**
 * Records an event on the tamper-evident chain. Safe to call from other
 * services (e.g. emergency, trips) to build an immutable audit trail.
 */
export async function recordEvent(
  eventType: string,
  payload: unknown
): Promise<LedgerRow> {
  return appendEntry(eventType, payload);
}

export async function getLedger(limit?: number, offset?: number): Promise<LedgerRow[]> {
  return listEntries(limit, offset);
}

/** Recomputes the whole chain and reports whether it is intact. */
export async function verifyLedger(): Promise<ChainVerification> {
  const entries = await allEntriesAscending();
  return verifyChain(entries);
}
