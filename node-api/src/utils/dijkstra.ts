/**
 * Minimal Dijkstra shortest-path over an undirected weighted graph.
 * Kept pure (no I/O) so it is unit-testable in isolation.
 */

export interface GraphEdge {
  source: number;
  target: number;
  cost: number;
}

export interface DijkstraResult {
  path: number[]; // node ids from start to end (inclusive)
  cost: number; // total accumulated cost along `path`
}

/**
 * Returns the least-cost path between `start` and `end`, or null if the two are
 * not connected. Edges are treated as undirected (usable in both directions).
 */
export function shortestPath(
  edges: GraphEdge[],
  start: number,
  end: number
): DijkstraResult | null {
  // Build undirected adjacency.
  const adj = new Map<number, Array<{ to: number; cost: number }>>();
  const addAdj = (a: number, b: number, cost: number) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, cost });
  };
  for (const e of edges) {
    addAdj(e.source, e.target, e.cost);
    addAdj(e.target, e.source, e.cost);
  }

  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const visited = new Set<number>();
  dist.set(start, 0);

  // Simple O(V^2) selection — the NER graph is tiny; a heap is unnecessary.
  const nodes = new Set<number>([start]);
  for (const e of edges) {
    nodes.add(e.source);
    nodes.add(e.target);
  }

  while (visited.size < nodes.size) {
    // Pick the unvisited node with the smallest tentative distance.
    let u: number | null = null;
    let best = Infinity;
    for (const n of nodes) {
      if (visited.has(n)) continue;
      const d = dist.get(n) ?? Infinity;
      if (d < best) {
        best = d;
        u = n;
      }
    }
    if (u === null || best === Infinity) break; // remaining nodes unreachable
    if (u === end) break;
    visited.add(u);

    for (const { to, cost } of adj.get(u) ?? []) {
      if (visited.has(to)) continue;
      const nd = best + cost;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, u);
      }
    }
  }

  if (!dist.has(end)) return null;

  // Reconstruct.
  const path: number[] = [];
  let cur: number | undefined = end;
  while (cur !== undefined) {
    path.unshift(cur);
    if (cur === start) break;
    cur = prev.get(cur);
    if (cur === undefined) return null; // no path
  }
  return { path, cost: dist.get(end)! };
}
