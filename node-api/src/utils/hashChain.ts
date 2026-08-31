import { createHash } from "crypto";

/** Genesis previous-hash: 64 zeros. */
export const GENESIS_PREV_HASH = "0".repeat(64);

/**
 * Deterministic JSON serialization with recursively sorted object keys, so the
 * same logical payload always hashes to the same string regardless of key
 * insertion order.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  // Respect toJSON (e.g. Date -> ISO string) so hashing a value BEFORE it is
  // stored matches hashing it AFTER a JSON/JSONB round-trip. Without this a
  // Date would hash as "{}" at write time but as a string at verify time.
  const maybeToJson = value as { toJSON?: () => unknown };
  if (typeof maybeToJson.toJSON === "function") {
    return canonicalStringify(maybeToJson.toJSON());
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`
  );
  return `{${entries.join(",")}}`;
}

export interface LedgerEntryCore {
  seq: number;
  event_type: string;
  payload: unknown;
  prev_hash: string;
  created_at: string;
}

/**
 * Computes the SHA-256 hash for a ledger entry over its immutable fields,
 * including the previous entry's hash — this chaining is what makes any
 * retroactive edit detectable.
 */
export function computeEntryHash(entry: LedgerEntryCore): string {
  const material = canonicalStringify({
    seq: entry.seq,
    event_type: entry.event_type,
    payload: entry.payload,
    prev_hash: entry.prev_hash,
    created_at: entry.created_at,
  });
  return createHash("sha256").update(material).digest("hex");
}

export interface StoredLedgerEntry extends LedgerEntryCore {
  hash: string;
}

export interface ChainVerification {
  valid: boolean;
  length: number;
  brokenAtSeq: number | null;
  reason: string | null;
}

/**
 * Verifies an ordered (by seq ascending) list of ledger entries:
 *   1. each entry's stored hash equals a recomputation from its fields, and
 *   2. each entry's prev_hash equals the actual hash of the entry before it.
 * Returns the first break found, or valid=true.
 */
export function verifyChain(entries: StoredLedgerEntry[]): ChainVerification {
  let expectedPrev = GENESIS_PREV_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prev_hash !== expectedPrev) {
      return {
        valid: false,
        length: entries.length,
        brokenAtSeq: e.seq,
        reason: `prev_hash mismatch at seq ${e.seq}`,
      };
    }
    const recomputed = computeEntryHash(e);
    if (recomputed !== e.hash) {
      return {
        valid: false,
        length: entries.length,
        brokenAtSeq: e.seq,
        reason: `hash mismatch at seq ${e.seq} (record was altered)`,
      };
    }
    expectedPrev = e.hash;
  }
  return { valid: true, length: entries.length, brokenAtSeq: null, reason: null };
}
