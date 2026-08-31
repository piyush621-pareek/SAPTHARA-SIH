import { shortestPath, GraphEdge } from "../utils/dijkstra";

const HAZARD_PENALTY = 1000;

// Mirror of the seeded NER graph topology (node ids 1..8).
const base: Array<{ source: number; target: number; km: number }> = [
  { source: 1, target: 2, km: 120 }, // Guwahati–Tezpur
  { source: 2, target: 3, km: 50 }, // Tezpur–Bhalukpong
  { source: 3, target: 4, km: 35 }, // Bhalukpong–Bomdila
  { source: 4, target: 5, km: 22 }, // Bomdila–Dirang
  { source: 5, target: 6, km: 25 }, // Dirang–Sela (direct)
  { source: 6, target: 8, km: 30 }, // Sela–Tawang (direct)
  { source: 5, target: 7, km: 24 }, // Dirang–Bypass
  { source: 7, target: 8, km: 40 }, // Bypass–Tawang
];

function withCosts(blocked: Set<string>): GraphEdge[] {
  const key = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
  return base.map((e) => ({
    source: e.source,
    target: e.target,
    cost: e.km * (blocked.has(key(e.source, e.target)) ? HAZARD_PENALTY : 1),
  }));
}

describe("shortestPath (Dijkstra)", () => {
  it("finds the direct route when nothing is blocked", () => {
    const res = shortestPath(withCosts(new Set()), 1, 8);
    expect(res).not.toBeNull();
    // Direct via Sela (…5-6-8) is shorter than the bypass (…5-7-8).
    expect(res!.path).toEqual([1, 2, 3, 4, 5, 6, 8]);
  });

  it("reroutes via the bypass when the Sela segments are hazardous", () => {
    const blocked = new Set(["5-6", "6-8"]); // Dirang–Sela, Sela–Tawang
    const res = shortestPath(withCosts(blocked), 1, 8);
    expect(res).not.toBeNull();
    // Detours through node 7 (bypass), skipping node 6 (Sela).
    expect(res!.path).toContain(7);
    expect(res!.path).not.toContain(6);
    expect(res!.path).toEqual([1, 2, 3, 4, 5, 7, 8]);
  });

  it("returns null for a disconnected target", () => {
    const res = shortestPath(withCosts(new Set()), 1, 999);
    expect(res).toBeNull();
  });

  it("handles start === end", () => {
    const res = shortestPath(withCosts(new Set()), 4, 4);
    expect(res).toEqual({ path: [4], cost: 0 });
  });
});
