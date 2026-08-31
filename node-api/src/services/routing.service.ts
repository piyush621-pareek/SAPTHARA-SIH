import {
  getNodes,
  getEdgesWithHazardStatus,
  nearestNode,
  RoadNode,
  RoadEdgeStatus,
} from "../repositories/routing.repository";
import { shortestPath, GraphEdge } from "../utils/dijkstra";
import { AppError } from "../utils/AppError";

// Multiplier applied to an edge that crosses an active hazard. Large enough
// that any hazard-free alternative is always preferred, but finite so a route
// can still be returned when the hazard is unavoidable.
const HAZARD_PENALTY = 1000;

export interface RouteResult {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  origin_node: { id: number; name: string };
  destination_node: { id: number; name: string };
  distance_km: number;
  status: "clear" | "rerouted" | "blocked_no_alternative";
  hazard_avoided: boolean;
  avoided_hazards: string[];
  unavoidable_hazards: string[];
  path: Array<{ id: number; name: string; lat: number; lng: number }>;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  // Both candidate routes (recommended + direct) so a client can compare them.
  alternatives: RouteAlternative[];
}

export interface RouteAlternative {
  id: string;
  name: string;
  status: "clear" | "rerouted" | "blocked_no_alternative" | "direct";
  distance_km: number;
  safety_score: number; // 0..100
  hazards: string[];
  path: Array<{ id: number; name: string; lat: number; lng: number }>;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

const edgeKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;

export async function computeRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): Promise<RouteResult> {
  const [startNode, endNode, nodes, edges] = await Promise.all([
    nearestNode(origin.latitude, origin.longitude),
    nearestNode(destination.latitude, destination.longitude),
    getNodes(),
    getEdgesWithHazardStatus(),
  ]);

  if (!startNode || !endNode) {
    throw AppError.notFound("No road network nodes near origin/destination");
  }

  const nodeById = new Map<number, RoadNode>(nodes.map((n) => [n.id, n]));
  const edgeByPair = new Map<string, RoadEdgeStatus>();
  for (const e of edges) edgeByPair.set(edgeKey(e.source, e.target), e);

  // Two cost models over the same topology.
  const naiveEdges: GraphEdge[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    cost: e.length_km,
  }));
  const safeEdges: GraphEdge[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    cost: e.length_km * (e.hazard_labels.length > 0 ? HAZARD_PENALTY : 1),
  }));

  const naive = shortestPath(naiveEdges, startNode.id, endNode.id);
  const safe = shortestPath(safeEdges, startNode.id, endNode.id);

  if (!safe || !naive) {
    throw new AppError(
      "Origin and destination are not connected in the road network",
      422
    );
  }

  // Edges used by each path.
  const usedEdges = (path: number[]): RoadEdgeStatus[] => {
    const list: RoadEdgeStatus[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const e = edgeByPair.get(edgeKey(path[i], path[i + 1]));
      if (e) list.push(e);
    }
    return list;
  };

  const safeUsed = usedEdges(safe.path);
  const naiveUsed = usedEdges(naive.path);

  const distance_km = round2(safeUsed.reduce((s, e) => s + e.length_km, 0));

  // Hazards that the naive shortest path would have driven through.
  const naiveHazards = new Set<string>();
  for (const e of naiveUsed) e.hazard_labels.forEach((h) => naiveHazards.add(h));

  // Hazards the SAFE path still cannot avoid (unavoidable).
  const unavoidable = new Set<string>();
  for (const e of safeUsed) e.hazard_labels.forEach((h) => unavoidable.add(h));

  const pathsDiffer =
    safe.path.length !== naive.path.length ||
    safe.path.some((n, i) => n !== naive.path[i]);

  let status: RouteResult["status"];
  if (unavoidable.size > 0) {
    status = "blocked_no_alternative";
  } else if (pathsDiffer && naiveHazards.size > 0) {
    status = "rerouted";
  } else {
    status = "clear";
  }

  // avoided = hazards on the naive route that the safe route sidesteps.
  const avoided = [...naiveHazards].filter((h) => !unavoidable.has(h));

  const toPathNodes = (ids: number[]) =>
    ids
      .map((id) => nodeById.get(id))
      .filter((n): n is RoadNode => !!n)
      .map((n) => ({ id: n.id, name: n.name, lat: n.lat, lng: n.lng }));

  // Build the drawn geometry from the real road-following EDGE polylines,
  // stitched in path order (each edge is stored source->target, so reverse it
  // when the path traverses it the other way). Falls back to node points if an
  // edge has no geometry. This is what makes the map render real curved roads.
  const stitchGeometry = (path: number[]) => {
    const coordinates: [number, number][] = [];
    const pushCoord = (c: [number, number]) => {
      const last = coordinates[coordinates.length - 1];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) coordinates.push(c);
    };
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const e = edgeByPair.get(edgeKey(a, b));
      let seg: [number, number][] | undefined = e?.coordinates?.length
        ? e.coordinates
        : undefined;
      if (seg) {
        // Orient the stored polyline to go from a -> b.
        if (e!.source === b && e!.target === a) seg = [...seg].reverse();
        for (const c of seg) pushCoord(c);
      } else {
        const na = nodeById.get(a);
        const nb = nodeById.get(b);
        if (na) pushCoord([na.lng, na.lat]);
        if (nb) pushCoord([nb.lng, nb.lat]);
      }
    }
    return { type: "LineString" as const, coordinates };
  };

  const pathNodes = toPathNodes(safe.path);

  // Build the two comparable options: recommended (safe) + direct (naive).
  const recommendedHazards = [...unavoidable];
  const recommended: RouteAlternative = {
    id: "recommended",
    name: status === "rerouted" ? "Recommended (Rerouted)" : "Recommended (Safe)",
    status,
    distance_km,
    safety_score: recommendedHazards.length > 0 ? 45 : 92,
    hazards: recommendedHazards,
    path: pathNodes,
    geometry: stitchGeometry(safe.path),
  };

  const directNodes = toPathNodes(naive.path);
  const directDistance = round2(naiveUsed.reduce((s, e) => s + e.length_km, 0));
  const directHazards = [...naiveHazards];
  const direct: RouteAlternative = {
    id: "direct",
    name: "Direct (Fastest)",
    status: "direct",
    distance_km: directDistance,
    safety_score: directHazards.length > 0 ? 35 : 90,
    hazards: directHazards,
    path: directNodes,
    geometry: stitchGeometry(naive.path),
  };

  // Only expose the direct option separately when it differs from the safe one.
  const alternatives = pathsDiffer ? [recommended, direct] : [recommended];

  return {
    origin: { lat: origin.latitude, lng: origin.longitude },
    destination: { lat: destination.latitude, lng: destination.longitude },
    origin_node: { id: startNode.id, name: startNode.name },
    destination_node: { id: endNode.id, name: endNode.name },
    distance_km,
    status,
    hazard_avoided: status === "rerouted",
    avoided_hazards: avoided,
    unavoidable_hazards: [...unavoidable],
    path: pathNodes,
    geometry: stitchGeometry(safe.path),
    alternatives,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
