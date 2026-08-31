#!/usr/bin/env node
// =============================================================================
// NER Fleet Simulator (SIH26002)
// Streams simulated GPS telemetry for a fleet of virtual trucks moving along the
// Guwahati -> Tawang highway, so the Command Dashboard and backend pipeline can
// be demoed live without physically driving with a phone.
//
// What it does on start:
//   1. Upserts the fleet vehicles into PostGIS (telemetry has an FK to vehicles).
//   2. Plants a landslide hazard geofence near Sela Pass (via the API), so trucks
//      passing through trigger real hazard:breach Socket.IO alerts.
//   3. Every tick, advances each truck along the route and POSTs a telemetry
//      batch to /api/v1/telemetry/batch (native-dedup safe).
//   4. Fires a scripted zero-network SOS for one truck mid-route
//      (POST /api/v1/emergency/sms with a Base64 distress frame).
//
// Config (env):
//   API_BASE_URL   default http://localhost:8080
//   DATABASE_URL   default postgres://ner_admin:ner_secret_2026@localhost:5432/ner_logistics
//   TICK_MS        default 3000   (ms between position updates)
//   SIM_SPEED_KMPH default 48     (base convoy speed; each truck varies)
//   SOS_AT_TICK    default 10     (tick at which the scripted SOS fires; 0 disables)
//   PLANT_HAZARD   default 1      (set 0 to skip creating the Sela Pass geofence)
//
// Flags:
//   --seed-only    upsert vehicles + hazard, then exit (no streaming)
// =============================================================================

const { Client } = require("pg");
const { GUWAHATI_TAWANG, RouteSampler } = require("./routes");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8080";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://ner_admin:ner_secret_2026@localhost:5432/ner_logistics";
const TICK_MS = Number(process.env.TICK_MS || 3000);
const BASE_SPEED = Number(process.env.SIM_SPEED_KMPH || 48);
const SOS_AT_TICK = Number(process.env.SOS_AT_TICK ?? 10);
const PLANT_HAZARD = process.env.PLANT_HAZARD !== "0";
const SEED_ONLY = process.argv.includes("--seed-only");

const API = `${API_BASE_URL}/api/v1`;
const sampler = new RouteSampler(GUWAHATI_TAWANG);

// Fleet: fixed UUIDs so repeated runs reuse the same vehicles (idempotent).
// Each truck starts at a different km offset and cruises at a slightly
// different speed, so the convoy spreads out naturally on the map.
const FLEET = [
  { id: "a1111111-1111-4111-8111-111111111111", reg: "AS01NER1001", name: "Convoy Alpha",   startKm: 0,   speed: BASE_SPEED + 4 },
  { id: "a2222222-2222-4222-8222-222222222222", reg: "AR02NER1002", name: "Convoy Bravo",    startKm: 55,  speed: BASE_SPEED - 3 },
  { id: "a3333333-3333-4333-8333-333333333333", reg: "AS01NER1003", name: "Relief Charlie",  startKm: 120, speed: BASE_SPEED + 1 },
  { id: "a4444444-4444-4444-8444-444444444444", reg: "AR02NER1004", name: "Medical Delta",   startKm: 175, speed: BASE_SPEED - 6 },
];

// Landslide hazard geofence around Sela Pass (a genuinely slide-prone stretch).
// Ring is [lng, lat] pairs (GeoJSON order) as the API expects.
const SELA_HAZARD = {
  label: "Sela Pass Landslide Zone (NH-13)",
  kind: "landslide",
  severity: 4,
  risk_score: 0.78,
  ring: [
    [92.06, 27.47],
    [92.15, 27.47],
    [92.15, 27.53],
    [92.06, 27.53],
    [92.06, 27.47],
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* non-JSON */
  }
  return { status: res.status, ok: res.ok, data };
}

/** Upserts the fleet vehicles directly into PostGIS. */
async function seedVehicles() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    for (const t of FLEET) {
      await client.query(
        `INSERT INTO vehicles (id, registration, model, capacity_kg, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (id) DO UPDATE
           SET registration = EXCLUDED.registration, status = 'active'`,
        [t.id, t.reg, "Tata LPT 1613 (sim)", 12000]
      );
    }
    console.log(`[seed] upserted ${FLEET.length} vehicles into PostGIS.`);
    // Clear any prior copy of the sim hazard so repeated runs don't stack
    // overlapping polygons on the map.
    const del = await client.query(`DELETE FROM hazards WHERE label = $1`, [
      SELA_HAZARD.label,
    ]);
    if (del.rowCount) console.log(`[seed] cleared ${del.rowCount} stale sim hazard(s).`);
  } finally {
    await client.end();
  }
}

/** Creates the Sela Pass hazard geofence via the API (idempotent-ish). */
async function plantHazard() {
  const res = await httpJson("POST", `${API}/hazards`, SELA_HAZARD);
  if (res.ok) {
    console.log(
      `[hazard] planted "${SELA_HAZARD.label}" (id=${res.data?.data?.id ?? "?"}).`
    );
  } else {
    console.log(`[hazard] could not plant hazard (HTTP ${res.status}).`);
  }
}

function b64(s) {
  return Buffer.from(s, "utf8").toString("base64");
}

/** Fires a scripted 2G-SMS-style SOS for the given truck at its current point. */
async function fireSos(truck, pt) {
  const frame = `${truck.id}|${pt.lat.toFixed(6)}|${pt.lng.toFixed(6)}|SOS engine failure ${truck.name}`;
  const res = await httpJson("POST", `${API}/emergency/sms`, {
    payload: b64(frame),
    sender: truck.reg,
  });
  if (res.ok) {
    console.log(
      `\n  🆘  SOS DISPATCHED  ${truck.name} @ ${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}` +
        `  → incident ${res.data?.data?.incidentId ?? "?"}` +
        (res.data?.data?.insideHazards?.length
          ? `  (inside: ${res.data.data.insideHazards.join(", ")})`
          : "") +
        "\n"
    );
  } else {
    console.log(`  🆘  SOS failed (HTTP ${res.status}).`);
  }
}

/** Builds one telemetry point for a truck at a route sample. */
function pointFor(truck, sample, nowIso) {
  return {
    vehicle_id: truck.id,
    timestamp: nowIso,
    latitude: Number(sample.lat.toFixed(6)),
    longitude: Number(sample.lng.toFixed(6)),
    speed_kmph: Number(truck.speed.toFixed(1)),
    heading_deg: Number(sample.heading.toFixed(1)),
    altitude_m: null,
    battery_pct: null,
    source: "internet",
  };
}

async function main() {
  console.log("========================================================");
  console.log(" NER Fleet Simulator — Guwahati → Tawang");
  console.log(` API   : ${API_BASE_URL}`);
  console.log(` Route : ${sampler.totalKm.toFixed(0)} km, ${FLEET.length} trucks`);
  console.log("========================================================\n");

  await seedVehicles();
  if (PLANT_HAZARD) await plantHazard();

  if (SEED_ONLY) {
    console.log("[seed-only] done. Exiting without streaming.");
    return;
  }

  // Per-truck distance travelled (km), initialized to its start offset.
  const progress = FLEET.map((t) => t.startKm);
  const dtHours = TICK_MS / 3600000;
  let tick = 0;
  let sosFired = false;

  // Graceful shutdown.
  let running = true;
  process.on("SIGINT", () => {
    running = false;
    console.log("\n[sim] stopping…");
  });

  while (running) {
    tick += 1;
    const nowIso = new Date().toISOString();
    const points = [];
    const rows = [];

    for (let i = 0; i < FLEET.length; i++) {
      const truck = FLEET[i];
      // Advance; loop back to the start once a truck reaches Tawang so the
      // demo runs indefinitely.
      progress[i] += truck.speed * dtHours;
      if (progress[i] > sampler.totalKm) progress[i] = 0;

      const sample = sampler.pointAtKm(progress[i]);
      points.push(pointFor(truck, sample, nowIso));
      rows.push(
        `${truck.name.padEnd(15)} ${progress[i].toFixed(0).padStart(3)}km ` +
          `${sample.lat.toFixed(4)},${sample.lng.toFixed(4)}  ${sample.segmentName}`
      );
    }

    const res = await httpJson("POST", `${API}/telemetry/batch`, { points });
    const d = res.data?.data;
    const breaches = d?.geofenceBreaches?.length
      ? `  ⚠ breach: ${d.geofenceBreaches
          .map((b) => b.hazards.join("/"))
          .join(", ")}`
      : "";

    console.clear();
    console.log(`NER Fleet Simulator — tick ${tick}  (${nowIso})`);
    console.log(
      `POST /telemetry/batch → HTTP ${res.status}` +
        (d ? `  inserted=${d.inserted} dup=${d.duplicatesSkipped}` : "") +
        breaches
    );
    console.log("--------------------------------------------------------");
    console.log(rows.join("\n"));

    // Scripted SOS: Medical Delta calls for help mid-route.
    if (!sosFired && SOS_AT_TICK > 0 && tick >= SOS_AT_TICK) {
      sosFired = true;
      const delta = FLEET[3];
      const sample = sampler.pointAtKm(progress[3]);
      await fireSos(delta, sample);
    }

    await sleep(TICK_MS);
  }

  console.log("[sim] stopped.");
}

main().catch((err) => {
  console.error("[sim] fatal:", err.message);
  process.exit(1);
});
