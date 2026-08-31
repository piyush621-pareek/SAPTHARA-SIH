import {
  canonicalStringify,
  computeEntryHash,
  verifyChain,
  GENESIS_PREV_HASH,
  StoredLedgerEntry,
} from "../utils/hashChain";

/** Builds a valid chain of N entries. */
function buildChain(events: Array<{ type: string; payload: unknown }>): StoredLedgerEntry[] {
  const chain: StoredLedgerEntry[] = [];
  let prev = GENESIS_PREV_HASH;
  events.forEach((e, i) => {
    const core = {
      seq: i,
      event_type: e.type,
      payload: e.payload,
      prev_hash: prev,
      created_at: new Date(1700000000000 + i * 1000).toISOString(),
    };
    const hash = computeEntryHash(core);
    chain.push({ ...core, hash });
    prev = hash;
  });
  return chain;
}

describe("canonicalStringify", () => {
  it("is stable regardless of key order", () => {
    expect(canonicalStringify({ b: 1, a: 2 })).toBe(
      canonicalStringify({ a: 2, b: 1 })
    );
  });
  it("handles nested objects and arrays", () => {
    const s = canonicalStringify({ x: [3, { z: 1, y: 2 }] });
    expect(s).toBe('{"x":[3,{"y":2,"z":1}]}');
  });
});

describe("computeEntryHash", () => {
  it("is deterministic", () => {
    const core = {
      seq: 1,
      event_type: "emergency.sos",
      payload: { a: 1 },
      prev_hash: GENESIS_PREV_HASH,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    expect(computeEntryHash(core)).toBe(computeEntryHash(core));
  });
  it("changes when any field changes", () => {
    const base = {
      seq: 1,
      event_type: "x",
      payload: { a: 1 },
      prev_hash: GENESIS_PREV_HASH,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const h1 = computeEntryHash(base);
    const h2 = computeEntryHash({ ...base, payload: { a: 2 } });
    expect(h1).not.toBe(h2);
  });
});

describe("verifyChain", () => {
  it("accepts an intact chain", () => {
    const chain = buildChain([
      { type: "genesis", payload: {} },
      { type: "emergency.sos", payload: { veh: "A" } },
      { type: "trip.status", payload: { status: "completed" } },
    ]);
    const result = verifyChain(chain);
    expect(result.valid).toBe(true);
    expect(result.length).toBe(3);
  });

  it("detects a tampered payload (hash mismatch)", () => {
    const chain = buildChain([
      { type: "a", payload: { v: 1 } },
      { type: "emergency.sos", payload: { veh: "A" } },
    ]);
    // Someone edits an old record's payload but can't recompute all hashes.
    chain[1].payload = { veh: "TAMPERED" };
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAtSeq).toBe(1);
  });

  it("detects a broken prev_hash link", () => {
    const chain = buildChain([
      { type: "a", payload: {} },
      { type: "b", payload: {} },
    ]);
    chain[1].prev_hash = "f".repeat(64);
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAtSeq).toBe(1);
  });

  it("accepts an empty chain", () => {
    expect(verifyChain([]).valid).toBe(true);
  });
});
