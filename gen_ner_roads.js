// Generates a real-geometry NER road graph for init-db.sql.
// Nodes = real NER cities (all 8 states). Edges = real national highways, whose
// geometry is fetched ONCE from OSRM (road-following polyline), decimated to a
// sane point count, and emitted as SQL. Synthetic edges (the Sela bypass) fall
// back to a straight line. Output: road_seed.sql  (run: node gen_ner_roads.js)
const fs = require("fs");

// id, name, lng, lat  — real coordinates across the North Eastern Region.
const NODES = [
  [1, "Guwahati", 91.7362, 26.1445],      // Assam
  [2, "Tezpur", 92.7926, 26.6338],        // Assam
  [3, "Bhalukpong", 92.6355, 27.0136],    // Arunachal
  [4, "Bomdila", 92.4159, 27.2646],       // Arunachal
  [5, "Dirang", 92.2417, 27.3597],        // Arunachal
  [6, "Sela Pass", 92.1042, 27.5033],     // Arunachal
  [7, "Sela Bypass", 92.0500, 27.6200],   // synthetic alt (fictional), N of hazard
  [8, "Tawang", 91.8594, 27.5859],        // Arunachal
  [9, "Shillong", 91.8933, 25.5788],      // Meghalaya
  [10, "Silchar", 92.7789, 24.8333],      // Assam (Barak valley)
  [11, "Nagaon", 92.6840, 26.3486],       // Assam
  [12, "Jorhat", 94.2036, 26.7509],       // Assam
  [13, "Dibrugarh", 94.9120, 27.4728],    // Assam
  [14, "Dimapur", 93.7266, 25.9091],      // Nagaland
  [15, "Kohima", 94.1086, 25.6751],       // Nagaland
  [16, "Imphal", 93.9368, 24.8170],       // Manipur
  [17, "Aizawl", 92.7176, 23.7271],       // Mizoram
  [18, "Agartala", 91.2868, 23.8315],     // Tripura
  [19, "Itanagar", 93.6053, 27.0844],     // Arunachal (capital)
  [20, "Tura", 90.2201, 25.5145],         // Meghalaya
  [21, "Gangtok", 88.6065, 27.3389],      // Sikkim
];

// source, target, name, synthetic?
const EDGES = [
  [1, 2, "NH-15 Guwahati–Tezpur"],
  [2, 3, "NH-13 Tezpur–Bhalukpong"],
  [3, 4, "NH-13 Bhalukpong–Bomdila"],
  [4, 5, "NH-13 Bomdila–Dirang"],
  [5, 6, "NH-13 Dirang–Sela"],
  [6, 8, "NH-13 Sela–Tawang"],
  [5, 7, "Bypass Dirang–Sela Bypass", true],
  [7, 8, "Bypass Sela Bypass–Tawang", true],
  [1, 9, "NH-6 Guwahati–Shillong"],
  [9, 10, "NH-6 Shillong–Silchar"],
  [1, 11, "NH-27 Guwahati–Nagaon"],
  [11, 12, "NH-37 Nagaon–Jorhat"],
  [12, 13, "NH-37 Jorhat–Dibrugarh"],
  [11, 14, "NH-36 Nagaon–Dimapur"],
  [14, 15, "NH-29 Dimapur–Kohima"],
  [15, 16, "NH-2 Kohima–Imphal"],
  [10, 17, "NH-306 Silchar–Aizawl"],
  [10, 18, "NH-8 Silchar–Agartala"],
  [2, 19, "NH-415 Tezpur–Itanagar"],
  [9, 20, "NH-51 Shillong–Tura"],
  [1, 21, "NH-17/10 Guwahati–Gangtok"],
];

const coordOf = (id) => { const n = NODES.find((x) => x[0] === id); return [n[2], n[3]]; };

async function osrm(a, b) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (r.ok) {
        const j = await r.json();
        if (j.routes && j.routes[0]) return j.routes[0].geometry.coordinates;
      }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null; // caller falls back to straight line
}

// Haversine distance in km between two [lng,lat] points.
function haversineKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]), dLng = toRad(a[0] - b[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function polyLenKm(coords) {
  let s = 0;
  for (let i = 1; i < coords.length; i++) s += haversineKm(coords[i - 1], coords[i]);
  return s;
}
// A bulged (arc) polyline from A to B whose length ≈ targetKm. Used for the
// synthetic Sela bypass: a real detour around the pass is far longer than the
// direct NH-13, so the fast route stays on NH-13 (through the hazard) and the
// safe route reroutes onto this longer bypass — the flagship reroute demo.
function arcOfLength(a, b, targetKm, awayFrom) {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // Unit perpendicular to A->B.
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-6;
  let px = -dy / len, py = dx / len;
  // Bulge to the side that moves AWAY from `awayFrom` (the hazard centroid), so
  // the longer bypass also clearly detours around the hazard polygon.
  if (awayFrom) {
    const plus = Math.hypot(mid[0] + px - awayFrom[0], mid[1] + py - awayFrom[1]);
    const minus = Math.hypot(mid[0] - px - awayFrom[0], mid[1] - py - awayFrom[1]);
    if (minus > plus) { px = -px; py = -py; }
  }
  const build = (h) => {
    const ctrl = [mid[0] + px * h, mid[1] + py * h];
    const pts = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      pts.push([
        u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0],
        u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1],
      ]);
    }
    return pts;
  };
  let lo = 0, hi = 3; // degrees of perpendicular bulge
  for (let iter = 0; iter < 24; iter++) {
    const h = (lo + hi) / 2;
    if (polyLenKm(build(h)) < targetKm) lo = h;
    else hi = h;
  }
  return build((lo + hi) / 2);
}

// Keep at most `max` points, always including first + last.
function decimate(coords, max = 100) {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(coords[Math.round(i * step)]);
  out[out.length - 1] = coords[coords.length - 1];
  return out;
}

const fmt = (c) => c.map(([lng, lat]) => `${lng.toFixed(5)} ${lat.toFixed(5)}`).join(", ");

(async () => {
  const nodeSql = NODES.map(
    ([id, name, lng, lat]) =>
      `    (${id}, '${name.replace(/'/g, "''")}', ST_GeographyFromText('SRID=4326;POINT(${lng} ${lat})'))`
  ).join(",\n");

  const edgeLines = [];
  for (const [s, t, name, synthetic] of EDGES) {
    const a = coordOf(s), b = coordOf(t);
    let coords;
    if (synthetic) {
      // Longer detour lengths so the bypass total (~130 km) exceeds the real
      // NH-13 Sela route (~94 km): keeps the "reroute around Sela" demo intact.
      // Bulge away from the Sela hazard centroid so the bypass detours around it.
      const SELA_HAZARD = [92.105, 27.5];
      const target = `${s}-${t}` === "5-7" ? 60 : 70;
      coords = arcOfLength(a, b, target, SELA_HAZARD);
      process.stdout.write(
        `  [synthetic arc] ${name}  (${coords.length} pts, ~${Math.round(polyLenKm(coords))} km)\n`
      );
    } else {
      const got = await osrm(a, b);
      coords = got ? decimate(got, 100) : [a, b];
      process.stdout.write(
        `  ${got ? "[osrm]" : "[FALLBACK straight]"} ${name}  (${coords.length} pts)\n`
      );
    }
    edgeLines.push(
      `    (${s}, ${t}, '${name.replace(/'/g, "''")}', ST_GeomFromText('LINESTRING(${fmt(coords)})', 4326))`
    );
  }

  const sql =
    `-- NER road graph (real OSRM geometry). Generated by gen_ner_roads.js\n` +
    `TRUNCATE road_edges RESTART IDENTITY;\nTRUNCATE road_nodes RESTART IDENTITY CASCADE;\n\n` +
    `INSERT INTO road_nodes (id, name, geom) VALUES\n${nodeSql};\n\n` +
    `INSERT INTO road_edges (source, target, name, geom) VALUES\n${edgeLines.join(",\n")};\n`;

  fs.writeFileSync("road_seed.sql", sql);
  console.log(`\nWROTE road_seed.sql  (${NODES.length} nodes, ${EDGES.length} edges)`);
})();
