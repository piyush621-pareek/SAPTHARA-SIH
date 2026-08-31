import { query, withTransaction } from "../config/db";
import {
  computeEntryHash,
  GENESIS_PREV_HASH,
  StoredLedgerEntry,
} from "../utils/hashChain";

// Arbitrary constant key for the advisory lock that serializes appends.
const LEDGER_LOCK_KEY = 815263;

export interface LedgerRow {
  seq: number;
  event_type: string;
  payload: unknown;
  prev_hash: string;
  hash: string;
  created_at: string;
}

/**
 * Appends an event to the hash chain atomically. A transaction-scoped advisory
 * lock guarantees only one appender computes "next seq / prev hash" at a time,
 * so the chain can never fork or race.
 */
export async function appendEntry(
  eventType: string,
  payload: unknown
): Promise<LedgerRow> {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [LEDGER_LOCK_KEY]);

    const tail = await client.query<{ seq: number; hash: string }>(
      "SELECT seq, hash FROM audit_ledger ORDER BY seq DESC LIMIT 1"
    );

    const prev = tail.rows[0];
    const seq = prev ? Number(prev.seq) + 1 : 0;
    const prevHash = prev ? prev.hash : GENESIS_PREV_HASH;
    const createdAt = new Date().toISOString();

    const hash = computeEntryHash({
      seq,
      event_type: eventType,
      payload,
      prev_hash: prevHash,
      created_at: createdAt,
    });

    const { rows } = await client.query<LedgerRow>(
      `INSERT INTO audit_ledger (seq, event_type, payload, prev_hash, hash, created_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       RETURNING seq, event_type, payload, prev_hash, hash, created_at`,
      [seq, eventType, JSON.stringify(payload ?? {}), prevHash, hash, createdAt]
    );
    return rows[0];
  });
}

export async function listEntries(limit = 100, offset = 0): Promise<LedgerRow[]> {
  const { rows } = await query<LedgerRow>(
    `SELECT seq, event_type, payload, prev_hash, hash, created_at
       FROM audit_ledger ORDER BY seq DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

/** Full chain in ascending order, for integrity verification. */
export async function allEntriesAscending(): Promise<StoredLedgerEntry[]> {
  const { rows } = await query<LedgerRow>(
    `SELECT seq, event_type, payload, prev_hash, hash, created_at
       FROM audit_ledger ORDER BY seq ASC`
  );
  return rows.map((r) => ({
    seq: Number(r.seq),
    event_type: r.event_type,
    payload: r.payload,
    prev_hash: r.prev_hash,
    created_at:
      typeof r.created_at === "string"
        ? r.created_at
        : new Date(r.created_at).toISOString(),
    hash: r.hash,
  }));
}
