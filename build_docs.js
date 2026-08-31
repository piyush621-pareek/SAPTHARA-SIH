// Generates the SIH26002 project documentation (.docx)
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  TableOfContents, PageBreak,
} = require("docx");

const ACCENT = "0B6E4F";
const DARK = "111827";
const GREY = "6B7280";

// ---- helpers ----------------------------------------------------------------
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 }, children: [new TextRun({ text: t, color: ACCENT, bold: true })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [new TextRun({ text: t, color: DARK, bold: true })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 }, children: [new TextRun({ text: t, color: DARK, bold: true })] });
const P = (runs, opts = {}) => new Paragraph({ spacing: { after: 120, line: 276 }, ...opts, children: Array.isArray(runs) ? runs : [new TextRun(runs)] });
const B = (label, rest) => new Paragraph({ spacing: { after: 120, line: 276 }, children: [new TextRun({ text: label, bold: true }), new TextRun(rest)] });
const bullet = (t, level = 0) => new Paragraph({ bullet: { level }, spacing: { after: 60, line: 268 }, children: typeof t === "string" ? [new TextRun(t)] : t });
const mono = (t) => new TextRun({ text: t, font: "Consolas", size: 19 });
const small = (t) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, italics: true, color: GREY, size: 19 })] });

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: ACCENT },
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 19 })] })],
    })),
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 ? "F3F4F6" : "FFFFFF" },
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      children: [new Paragraph({ children: [new TextRun({ text: c, size: 19 })] })],
    })),
  }));
  return new Table({ columnWidths: widths, width: { size: total, type: WidthType.DXA }, rows: [headerRow, ...bodyRows] });
}

const children = [];

// ---- Title page -------------------------------------------------------------
children.push(
  new Paragraph({ spacing: { before: 1600, after: 60 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "AI-Based Smart Logistics &", bold: true, size: 44, color: ACCENT })] }),
  new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Accessibility Intelligence Platform — NER", bold: true, size: 44, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Smart India Hackathon 2026  ·  Problem Statement SIH26002", size: 26, color: DARK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "Theme: Transportation & Logistics  ·  Category: Software", size: 22, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Technical Documentation — Backend & Frontend", bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "What was built, why, and how", italics: true, size: 22, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Generated: 29 August 2026", size: 20, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---- TOC --------------------------------------------------------------------
children.push(H1("Table of Contents"));
children.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 1. Executive summary ---------------------------------------------------
children.push(H1("1. Executive Summary"));
children.push(P("This platform tackles the logistics and accessibility bottlenecks of India's eight North Eastern (NER) states — extreme cellular dead zones, monsoon landslides that sever single-road mountain corridors, and slow emergency response. It follows an \"Edge-First, Spatially Aware\" philosophy: devices keep working offline, spatial intelligence (PostGIS) drives geofencing and rerouting, and a multi-tier emergency fallback (2G SMS, BLE mesh) guarantees a distress signal can always leave the field."));
children.push(B("What exists today: ", "a production-shaped backend (Node.js + PostGIS + a Python AI microservice), two Flutter mobile apps (a Driver app and the Saptahara field-officer app), a React command-and-control dashboard, and a fleet simulator. All components were built, compiled, and verified running end-to-end (live smoke tests, an automated backend test suite, and on-device runs on an Android emulator)."));
children.push(H2("Components at a glance"));
children.push(table(
  ["Component", "Stack", "Status"],
  [
    ["Backend API", "Node.js / Express / TypeScript", "Built & verified running"],
    ["Spatial database", "PostgreSQL + PostGIS", "6+ tables, geofencing, dedup"],
    ["AI microservice", "Python / FastAPI / scikit-learn", "Landslide risk model"],
    ["Driver App", "Flutter (offline-first)", "Runs on emulator"],
    ["Saptahara App", "Flutter (field officer)", "Integrated to backend"],
    ["Command Dashboard", "React / Vite / MapLibre", "Live, real-time"],
    ["Fleet Simulator", "Node.js", "Streams virtual trucks"],
  ],
  [2600, 4200, 2560]
));

// ---- 2. Architecture --------------------------------------------------------
children.push(H1("2. System Architecture"));
children.push(P("The system is organised in three layers:"));
children.push(bullet([new TextRun({ text: "Edge layer — ", bold: true }), new TextRun("the Flutter apps on drivers' / field officers' phones. They capture GPS, cache telemetry offline in SQLite, and trigger SOS over data, 2G SMS, or BLE mesh.")]));
children.push(bullet([new TextRun({ text: "Core layer — ", bold: true }), new TextRun("the Node/Express API backed by PostGIS and Redis, plus the FastAPI AI microservice. It ingests telemetry, runs spatial geofencing, computes hazard-aware routes, decodes emergencies, and broadcasts real-time events over Socket.IO.")]));
children.push(bullet([new TextRun({ text: "Command layer — ", bold: true }), new TextRun("the React dashboard for authorities (MDoNER evaluators' \"control room\"): live trucks on a map, hazard geofences turning red, and SOS alerts in real time.")]));
children.push(B("Why this shape: ", "the NER's defining constraint is unreliable connectivity, so the edge must be self-sufficient (offline-first) and the core must be resilient (fail-fast, graceful fallback). PostGIS was chosen because the core problems — is a vehicle inside a hazard zone, what is the safest route around it, what hazards are within N km — are fundamentally spatial queries."));
children.push(B("Orchestration: ", "everything runs via Docker Compose (PostGIS, Redis, the Node API, and the FastAPI service on one network). A single command brings the whole backend up."));

// ---- 3. Backend -------------------------------------------------------------
children.push(H1("3. Backend"));
children.push(H2("3.1 What it is"));
children.push(P("A TypeScript Express API following a strict Controller → Service → Repository pattern, with Zod validation middleware and a centralised async error handler. It exposes a versioned REST API under /api/v1 plus a Socket.IO real-time channel."));
children.push(H2("3.2 Why these choices"));
children.push(bullet([new TextRun({ text: "Controller/Service/Repository ", bold: true }), new TextRun("keeps HTTP concerns, business logic, and SQL cleanly separated and testable.")]));
children.push(bullet([new TextRun({ text: "Zod validation ", bold: true }), new TextRun("rejects malformed input at the edge of every route, returning consistent 422s.")]));
children.push(bullet([new TextRun({ text: "Central error handler ", bold: true }), new TextRun("maps Zod, PostgreSQL error codes, and typed AppErrors to clean HTTP responses (400/401/404/409/422/500).")]));
children.push(bullet([new TextRun({ text: "Native DB deduplication ", bold: true }), new TextRun("— a compound UNIQUE(vehicle_id, timestamp) with INSERT ... ON CONFLICT DO NOTHING means re-uploaded offline buffers can never create duplicates, without any application-side logic.")]));
children.push(H2("3.3 How it is built — key modules"));
children.push(H3("Telemetry & resilient offline sync"));
children.push(P("POST /telemetry/batch bulk-inserts buffered edge points using native ON CONFLICT dedup and returns how many were genuinely new; it then runs a PostGIS geofence pass (ST_Contains) over the fresh points and pushes hazard:breach alerts. POST /telemetry/relay decodes a Base64 BLE-mesh frame."));
children.push(H3("Spatial hazards (PostGIS)"));
children.push(P("Hazard polygons are stored as GEOMETRY; queries use ST_DWithin (metre-accurate proximity), ST_Contains (geofence collision), and ST_Intersects (route–hazard crossing). GiST spatial indexes back every geometry column."));
children.push(H3("Multi-tier emergency"));
children.push(P("POST /emergency/sms decodes a Base64 distress payload (pipe or JSON frame → vehicle, lat, lng, message), persists an incident, anchors it to the audit ledger, and emits a real-time emergency:alert over Socket.IO. An unrecognised vehicle id is stored as NULL rather than dropping the distress signal."));
children.push(H3("Hazard-aware rerouting engine"));
children.push(P("A road network (road_nodes + road_edges) is held in PostGIS. For a trip, one SQL query flags every edge whose LineString ST_Intersects an active hazard polygon; a Dijkstra shortest-path then runs twice — once on raw distance, once with hazard-crossing edges penalised ×1000 — so the safest route detours around live geofences. The response classifies the result as clear, rerouted, or blocked_no_alternative and returns both the recommended and direct routes as GeoJSON."));
children.push(H3("JWT authentication"));
children.push(P("POST /auth/register (bcrypt-hashed) and /auth/login issue JWTs; a requireAuth middleware guards operator routes (trips, ledger append). Edge/gateway routes (telemetry, emergency, fleet, public hazard reads) stay open by design, as they would use device/service credentials in production."));
children.push(H3("Tamper-evident audit ledger (blockchain-inspired)"));
children.push(P("Each ledger entry stores the SHA-256 hash of its own fields plus the previous entry's hash (a hash chain from a genesis of 64 zeros). Emergencies and field reports are auto-anchored to it. GET /ledger/verify recomputes the whole chain and returns valid / the first broken sequence — so any retroactive edit to an old record is provably detectable. This is blockchain's cryptographic tamper-evidence, but single-writer (not a distributed/consensus blockchain)."));
children.push(H2("3.4 API surface"));
children.push(table(
  ["Endpoint", "Purpose"],
  [
    ["GET /health", "Liveness"],
    ["POST /auth/register · /login · GET /auth/me", "JWT auth"],
    ["POST /telemetry/batch · /relay", "Offline bulk sync · BLE relay"],
    ["GET/POST /hazards, /hazards/nearby, /contains, /risk", "Geofencing & risk"],
    ["POST /emergency/sms", "2G SMS distress webhook"],
    ["GET /fleet", "Vehicles + last position"],
    ["POST/GET/PATCH /trips, /trips/:id/track", "Trip management (JWT)"],
    ["GET/POST /ledger, /ledger/verify", "Tamper-evident ledger"],
    ["GET /geo/context · /risk · /layers", "ISRO satellite feeds"],
    ["POST /routing/route", "Hazard-aware rerouting"],
    ["POST/GET /reports", "Field reports (ledger-anchored)"],
    ["POST /predict (AI :9000)", "Landslide risk model"],
  ],
  [5200, 4160]
));
children.push(H2("3.5 AI microservice"));
children.push(P("A FastAPI service exposes POST /predict (inputs: latitude, longitude, rainfall_mm, soil_moisture, slope). It blends a physically-motivated monsoon-landslide heuristic with a scikit-learn logistic-regression model trained on synthetic, physically-labelled samples at start-up, and returns a 0–1 risk_score, a recommended_action (PROCEED / CAUTION / REROUTE / HALT), and a factor breakdown. It is honestly a heuristic + synthetic model, not trained on real ground-truth data."));

// ---- 4. ISRO ----------------------------------------------------------------
children.push(H1("4. ISRO Satellite Integration"));
children.push(H2("4.1 Integration status (important)"));
children.push(table(
  ["Layer", "ISRO integrated?", "Detail"],
  [
    ["Backend (node-api)", "YES — code + endpoints", "Bhuvan, MOSDAC, CartoDEM clients; /geo endpoints. Returns a modelled fallback until real tokens are set."],
    ["Command Dashboard (React)", "YES — surfaced", "\"Satellite Risk\" card calls GET /geo/risk and shows the fused result + source tags."],
    ["Saptahara app (Flutter)", "NO — not yet surfaced", "Does not call the /geo endpoints. A drop-in addition."],
    ["Driver app (Flutter)", "NO", "Uses /hazards/risk (AI only), not the ISRO feeds."],
  ],
  [2500, 2500, 4360]
));
children.push(small("In short: ISRO is integrated in the BACKEND (with a graceful modelled fallback) and surfaced on the DASHBOARD. It is not yet wired into the two mobile apps."));
children.push(H2("4.2 What was built"));
children.push(bullet([new TextRun({ text: "Bhuvan client — ", bold: true }), new TextRun("WMS GetFeatureInfo against Bhuvan (NRSC) for landslide-susceptibility class at a point.")]));
children.push(bullet([new TextRun({ text: "MOSDAC client — ", bold: true }), new TextRun("satellite-derived rainfall + soil-moisture for a coordinate.")]));
children.push(bullet([new TextRun({ text: "CartoDEM client — ", bold: true }), new TextRun("elevation from the Cartosat-1 DEM (via Bhuvan) at a 5-point stencil, with slope derived from the elevation differences.")]));
children.push(bullet([new TextRun({ text: "geo.service — ", bold: true }), new TextRun("fuses all three feeds and drives the FastAPI landslide model with the real satellite-derived inputs, then blends with Bhuvan susceptibility for a final rerouting decision.")]));
children.push(P("Every field is tagged with its true source: live (mosdac / cartodem / bhuvan_wms) or modelled. This is deliberate honesty — live NRSC/SAC data requires ISRO-issued tokens, so without them the service returns a physically-plausible NER monsoon/terrain fallback rather than pretending."));
children.push(H2("4.3 How to use the real ISRO API"));
children.push(P("Two steps — get tokens, then set environment variables. No code change is required; the clients switch from \"modelled\" to \"live\" automatically."));
children.push(H3("Step 1 — Register and obtain tokens"));
children.push(bullet([new TextRun({ text: "Bhuvan (NRSC/ISRO): ", bold: true }), new TextRun("register at bhuvan.nrsc.gov.in and request an API access token / API key for the WMS/thematic services (landslide susceptibility, CartoDEM terrain layers).")]));
children.push(bullet([new TextRun({ text: "MOSDAC (SAC/ISRO): ", bold: true }), new TextRun("register at mosdac.gov.in and request access to the point-data / rainfall products.")]));
children.push(bullet([new TextRun({ text: "CartoDEM: ", bold: true }), new TextRun("distributed via Bhuvan — the same Bhuvan credentials typically cover the DEM/elevation service.")]));
children.push(H3("Step 2 — Configure the backend"));
children.push(P("Set these variables (in docker-compose.yml under the node-api service, or in node-api/.env), then restart the container:"));
children.push(P([mono("BHUVAN_TOKEN=<your token>")], { spacing: { after: 20 } }));
children.push(P([mono("MOSDAC_TOKEN=<your token>")], { spacing: { after: 20 } }));
children.push(P([mono("CARTODEM_TOKEN=<your token>")], { spacing: { after: 20 } }));
children.push(P([mono("# optional overrides:")], { spacing: { after: 20 } }));
children.push(P([mono("BHUVAN_WMS_URL, BHUVAN_LANDSLIDE_LAYER, MOSDAC_BASE_URL, CARTODEM_URL")], { spacing: { after: 120 } }));
children.push(P([new TextRun("Restart: "), mono("docker compose up -d --build node-api"), new TextRun(". Verify with "), mono("GET /api/v1/geo/context?lat=27.5&lng=92.1"), new TextRun(" — the \"sources\" fields should flip from \"modelled\" to \"mosdac\"/\"cartodem\"/\"bhuvan_wms\".")]));
children.push(H3("Step 3 (optional) — Surface on the dashboard / apps"));
children.push(P("The dashboard already shows the fused result. To use live tiles, GET /geo/layers returns the Bhuvan/CartoDEM WMS layer descriptors that a map (MapLibre or flutter_map) can add directly."));

// ---- 5. Frontend ------------------------------------------------------------
children.push(H1("5. Frontend"));
children.push(H2("5.1 Driver App (Flutter, edge layer)"));
children.push(B("What: ", "an offline-first driver app — continuous GPS capture, telemetry sent when online and cached to SQLite when offline, background sync (WorkManager), and a multi-tier SOS (HTTP → Base64 2G-SMS → BLE mesh)."));
children.push(B("Why: ", "the NER's cellular dead zones mean the app must lose nothing offline and must always be able to raise an SOS."));
children.push(B("How: ", "a clean service split — LocationService (send/queue), SyncService (batched drain with native dedup, foreground + background isolate), EmergencyService (the fallback ladder). The map is flutter_map / OpenStreetMap. Verified running on an Android 16 emulator: map, network-status pill, safety banner, and the SOS button all render, backed by 3 passing widget tests."));
children.push(H2("5.2 Saptahara App (Flutter, field officer)"));
children.push(B("What: ", "a clean-architecture field-officer app (routes, alerts, offline reports, verification, SOS). It arrived as a well-built but fully mock-only app (no networking) and was integrated to the live backend."));
children.push(B("Why: ", "its domain model mapped almost one-to-one to the backend, and it was designed with a \"swap Mock for Api\" seam — the correct place to connect real data."));
children.push(B("How — the integration: ", ""));
children.push(table(
  ["Feature", "Now backed by"],
  [
    ["Routes (map + \"274 km rerouted\")", "POST /routing/route (reroute engine)"],
    ["Current Alerts", "GET /hazards + live Socket.IO"],
    ["Geofences", "GET /hazards polygons"],
    ["Report sync", "POST /reports (real upload)"],
    ["Verification receipt", "the ledger hash returned at sync"],
    ["SEND SOS", "POST /emergency/sms"],
  ],
  [4400, 4960]
));
children.push(P("Further enhancements, all verified on the emulator:"));
children.push(bullet("Mock canvas replaced with a real flutter_map / OpenStreetMap tile view (routes, geofences, hazard markers plotted on real NER geography)."));
children.push(bullet("Live socket indicator — the LIVE / RECONNECTING pill reflects the real Socket.IO connection (proven by stopping and restarting the backend)."));
children.push(bullet("Socket-alert toasts — a new emergency:alert / hazard:breach surfaces an app-wide, severity-coloured toast."));
children.push(bullet("Toast deep-link — tapping a toast jumps to the Home map and flies the camera to the alert with a highlight ring."));
children.push(H2("5.3 Command Dashboard (React / Vite)"));
children.push(B("What: ", "the authorities' control room — a MapLibre map showing live trucks, hazard geofences, SOS alerts, a satellite-risk panel, a hash-chain audit-ledger panel, and the recommended route."));
children.push(B("Why: ", "MDoNER evaluators want to see the central picture, not just a driver's phone."));
children.push(B("How: ", "socket.io-client streams fleet:update / hazard:breach / emergency:alert; the map draws truck markers, hazard polygons (turning red on breach), pulsing SOS pings, and the route as a green (recommended) vs red-dashed (direct) polyline that re-draws when a hazard activates. Clicking the map queries GET /geo/risk (the ISRO fused risk). All verified live."));

// ---- 6. Simulator + testing -------------------------------------------------
children.push(H1("6. Simulator & Verification"));
children.push(H2("6.1 Fleet simulator"));
children.push(P("A Node.js script streams four virtual trucks along the Guwahati → Tawang highway: it seeds the vehicles into PostGIS, plants a Sela Pass hazard geofence, streams telemetry batches (driving live fleet movement + geofence breaches), and fires a scripted SOS mid-route — so judges can watch the whole pipeline without physically driving with a phone."));
children.push(H2("6.2 What was verified"));
children.push(bullet("Backend: docker compose up, all containers healthy; every endpoint smoke-tested live (dedup, ST_DWithin/ST_Contains geofencing, AI risk, SMS decode, error paths)."));
children.push(bullet("Automated tests: 42 passing backend tests (auth/bcrypt/JWT, emergency decode, requireAuth, Dijkstra/reroute, hash-chain tamper-detection, and supertest API tests)."));
children.push(bullet("Rerouting: clear → rerouted transition proven (direct route through Sela Pass vs safe detour)."));
children.push(bullet("Driver app & Saptahara: built and run on the Android emulator with live backend data."));
children.push(bullet("Dashboard: live trucks, geofence-red-on-breach, SOS pop-ups, satellite risk, and route rendering all confirmed in the browser."));

// ---- 7. What's left ---------------------------------------------------------
children.push(H1("7. What Remains To Be Added"));
children.push(H2("7.1 Backend"));
children.push(bullet([new TextRun({ text: "Real ISRO tokens ", bold: true }), new TextRun("— flip Bhuvan/MOSDAC/CartoDEM from modelled fallback to live (section 4.3).")]));
children.push(bullet([new TextRun({ text: "Real outbound SMS gateway ", bold: true }), new TextRun("— /emergency/sms decodes distress but does not yet send an alert out to responders.")]));
children.push(bullet([new TextRun({ text: "Trip ↔ telemetry linking ", bold: true }), new TextRun("— telemetry does not yet carry an active trip_id, so /trips/:id/track is currently empty.")]));
children.push(bullet([new TextRun({ text: "Security hardening ", bold: true }), new TextRun("— WebSocket (Socket.IO) auth, rate limiting/throttling, refresh tokens + revocation, and secrets management (JWT secret and DB password are currently in compose).")]));
children.push(bullet([new TextRun({ text: "Admin CRUD ", bold: true }), new TextRun("— endpoints for users and vehicles; pagination on list endpoints.")]));
children.push(bullet([new TextRun({ text: "Migrations tooling ", bold: true }), new TextRun("— replace manual ALTERs with a migration framework (e.g. node-pg-migrate).")]));
children.push(bullet([new TextRun({ text: "Scale & ops ", bold: true }), new TextRun("— TimescaleDB / partitioning + a queue (Kafka) for fleet-scale telemetry; structured logging, metrics, and a CI/CD pipeline running the tests.")]));
children.push(bullet([new TextRun({ text: "Real routing graph ", bold: true }), new TextRun("— the Dijkstra reroute uses a curated NER corridor graph; a city-scale version would load a full OpenStreetMap network via osm2pgrouting / pgRouting.")]));
children.push(H2("7.2 Frontend"));
children.push(bullet([new TextRun({ text: "Saptahara: surface ISRO satellite risk ", bold: true }), new TextRun("(a /geo/risk card), dedupe repeated alert entries, extend toasts/deep-link to hazard:breach, wire real GPS (geolocator) instead of the fixed demo coordinate, and persist offline reports to disk (currently in-memory).")]));
children.push(bullet([new TextRun({ text: "Auth screens ", bold: true }), new TextRun("— a login flow using /auth so operator actions carry a real JWT.")]));
children.push(bullet([new TextRun({ text: "Push notifications ", bold: true }), new TextRun("— background alerts when the app is closed.")]));
children.push(bullet([new TextRun({ text: "Localization & accessibility ", bold: true }), new TextRun("— NER languages and accessible layouts (the platform's \"Accessibility\" mandate).")]));
children.push(bullet([new TextRun({ text: "Dashboard: authentication ", bold: true }), new TextRun("and a few more operational KPIs / historical playback.")]));

// ---- 8. How to run ----------------------------------------------------------
children.push(H1("8. How To Run"));
children.push(H2("8.1 Backend (all four services)"));
children.push(P([new TextRun("Start Docker Desktop, then from the project root:")]));
children.push(P([mono("docker compose up -d --build")]));
children.push(P([new TextRun("Verify: "), mono("curl http://localhost:8080/api/v1/health"), new TextRun(". Run tests: "), mono("cd node-api && npm test"), new TextRun(".")]));
children.push(small("Note: on this machine the Docker CLI is a per-user install not on PATH. If \"docker\" is not recognised, prepend %LOCALAPPDATA%\\Programs\\DockerDesktop\\resources\\bin to PATH."));
children.push(H2("8.2 Full live demo"));
children.push(P([new TextRun("In separate terminals: "), mono("cd dashboard && npm run dev"), new TextRun("  and  "), mono("cd simulator && node simulate.js"), new TextRun(". Open http://localhost:5173 — trucks move, the SOS fires, geofences turn red, the ledger chains, and satellite risk is one click away.")]));
children.push(H2("8.3 Mobile apps (emulator)"));
children.push(P([new TextRun("Flutter lives on D:\\flutter. Launch the emulator, then from an app folder (driver-app or saptahara_frontend/saptahara): "), mono("flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:8080"), new TextRun(".")]));
children.push(small("10.0.2.2 is the Android emulator's alias for the host's localhost; a physical device uses the host LAN IP."));

const doc = new Document({
  creator: "SIH26002 Team",
  title: "SIH26002 — NER Smart Logistics Platform — Technical Documentation",
  styles: {
    default: { document: { run: { font: "Calibri", size: 22, color: "1F2937" } } },
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("SIH26002_Documentation.docx", buf);
  console.log("WROTE SIH26002_Documentation.docx", buf.length, "bytes");
});
