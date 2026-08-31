// Generates the SIH26002 full technical + teaching guide (.docx)
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, TableOfContents, PageBreak,
} = require("docx");

const ACCENT = "0B6E4F", DARK = "111827", GREY = "6B7280", BLUE = "1D4ED8";
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 340, after: 140 }, children: [new TextRun({ text: t, color: ACCENT, bold: true })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 90 }, children: [new TextRun({ text: t, color: DARK, bold: true })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 70 }, children: [new TextRun({ text: t, color: BLUE, bold: true })] });
const P = (t) => new Paragraph({ spacing: { after: 110, line: 274 }, children: typeof t === "string" ? [new TextRun(t)] : t });
const B = (label, rest) => new Paragraph({ spacing: { after: 110, line: 274 }, children: [new TextRun({ text: label, bold: true }), new TextRun(rest)] });
const li = (t, lvl = 0) => new Paragraph({ bullet: { level: lvl }, spacing: { after: 50, line: 264 }, children: typeof t === "string" ? [new TextRun(t)] : t });
const num = (t, ref) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 50, line: 264 }, children: typeof t === "string" ? [new TextRun(t)] : t });
const code = (t) => new Paragraph({ spacing: { after: 8 }, shading: { type: ShadingType.CLEAR, fill: "F3F4F6" }, children: [new TextRun({ text: t, font: "Consolas", size: 18 })] });
const mono = (t) => new TextRun({ text: t, font: "Consolas", size: 18 });
const note = (t) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, italics: true, color: GREY, size: 19 })] });

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const hdr = new TableRow({ tableHeader: true, children: headers.map((h, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: ACCENT }, margins: { top: 50, bottom: 50, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18 })] })] })) });
  const body = rows.map((r, ri) => new TableRow({ children: r.map((c, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: ri % 2 ? "F3F4F6" : "FFFFFF" }, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: c, size: 18 })] })] })) }));
  return new Table({ columnWidths: widths, width: { size: total, type: WidthType.DXA }, rows: [hdr, ...body] });
}

const c = [];

// Title
c.push(
  new Paragraph({ spacing: { before: 1500, after: 60 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SAPTHARA — NER Smart Logistics", bold: true, size: 40, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "& Accessibility Intelligence Platform", bold: true, size: 40, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Full Technical & Teaching Guide", bold: true, size: 30 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "SIH 2026 · Problem Statement SIH26002 · Transportation & Logistics", size: 22, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Phase-wise build · architecture · how to run · how to modify it yourself · how to explain to judges", italics: true, size: 20, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
);
c.push(H1("Table of Contents"));
c.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }));
c.push(new Paragraph({ children: [new PageBreak()] }));

// 0. How to use
c.push(H1("0. How to Use This Guide"));
c.push(P("This document is written so a team member (or you, before the judges) can understand the whole system without having built it. Read it in order the first time:"));
c.push(li("Sections 1–2 give the big picture and the phase-by-phase story of what was built and why."));
c.push(li("Sections 3–6 are the technical deep dive (architecture, backend, frontend, dashboard)."));
c.push(li("Section 7 is how to run everything (including on a real phone)."));
c.push(li([new TextRun({ text: "Section 8 is the most practical: ", bold: true }), new TextRun("how to make changes yourself — exact files to edit for common tasks.")]));
c.push(li([new TextRun({ text: "Section 9 ", bold: true }), new TextRun("is your judge-prep: talking points, likely questions, and honest answers.")]));
c.push(li("Section 10 is a plain-English glossary of every technical term used."));

// 1. Overview
c.push(H1("1. What We Built (Overview)"));
c.push(P("A logistics + accessibility platform for India's 8 North Eastern (NER) states, where the real problems are cellular dead zones, monsoon landslides that cut single-road mountain corridors, and slow emergency response. Design philosophy: \"Edge-First, Spatially Aware\" — phones keep working offline, and spatial intelligence (PostGIS) drives geofencing and rerouting."));
c.push(H2("The four parts"));
c.push(table(["Part", "Technology", "Role"], [
  ["Backend API", "Node.js + Express + TypeScript", "Data engine, spatial router, real-time gateway"],
  ["Spatial DB", "PostgreSQL + PostGIS", "Geofencing, dedup, road graph, ledger"],
  ["AI service", "Python + FastAPI + scikit-learn", "Landslide risk prediction"],
  ["SAPTHARA app", "Flutter (Android)", "Single app for BOTH driver + field officer"],
  ["Command Dashboard", "React + Vite + MapLibre", "Authority control room (live map)"],
  ["Fleet Simulator", "Node.js", "Streams virtual trucks for demos"],
], [2400, 3200, 3760]));
c.push(note("Note: an earlier 'driver-app' Flutter project exists but is superseded — SAPTHARA is the single frontend for drivers and field officers."));

// 2. Phase-wise build
c.push(H1("2. Phase-by-Phase Build Log (What, Why, How)"));
const phases = [
  ["Phase 1 — Backend core", "Ingest telemetry, store spatial data, expose an API.", "Express + PostGIS + Redis + FastAPI via Docker Compose. Controller→Service→Repository pattern, Zod validation, central error handler. Telemetry batch uses a compound UNIQUE(vehicle_id,timestamp) with ON CONFLICT DO NOTHING = native offline-sync dedup."],
  ["Phase 2 — AI microservice (multi-hazard)", "Predict every disruption type in PS 26002 (b).", "FastAPI hosts THREE models, each trained on a REAL dataset, blended with physics heuristics: (1) Landslide — NASA Global Landslide Catalog, North-East-India events only, ROC-AUC 0.85 (POST /predict); (2) Flood — India Flood Inventory (IMD), all 8 NER states, district-geocoded, ROC-AUC 0.87 (POST /predict/flood); (3) Congestion — UCI Metro Traffic (48k hourly records), ROC-AUC 0.97 (POST /predict/congestion). Each returns risk 0–1 + action (PROCEED/CAUTION/REROUTE/HALT). Retrainable via train.py --ner-only, train_flood.py --ifi, train_congestion.py."],
  ["Phase 3 — Driver app (Flutter)", "Edge app: capture GPS, work offline, SOS.", "Offline-first telemetry (SQLite cache + WorkManager sync) and a multi-tier SOS (HTTP → Base64 2G-SMS → BLE mesh). (Later superseded by SAPTHARA.)"],
  ["Phase 4 — Fleet simulator", "Demo without driving a phone around.", "Node script streams 4 virtual trucks along Guwahati→Tawang, plants a Sela-Pass hazard, fires a scripted SOS."],
  ["Phase 5 — Command dashboard", "Authorities' live control room.", "React + MapLibre; Socket.IO streams fleet:update / hazard:breach / emergency:alert; trucks move, geofences turn red, SOS pings pulse."],
  ["Phase 6 — Rerouting engine", "Deliver the 'predictive rerouting' promise.", "Road graph in PostGIS; ST_Intersects flags edges crossing active hazards; Dijkstra runs twice (raw vs hazard-penalised) → safe detour. Returns clear/rerouted/blocked. The graph covers 21 real NER cities across all 8 states (21 national highways), and each edge carries REAL road-following geometry (fetched once from OSRM, baked into the DB) so routes render as real curved roads — fully offline, no runtime internet."],
  ["Phase 7 — Tamper-evident ledger", "Trust: immutable audit of SOS/reports.", "SHA-256 hash chain (each entry hashes the previous). GET /ledger/verify recomputes the chain; any edit to an old record is provably detected. (Blockchain-style, single-writer.)"],
  ["Phase 8 — ISRO integration", "Real satellite-driven risk.", "Bhuvan (landslide susceptibility) + MOSDAC (rainfall/soil) + CartoDEM (elevation→slope) clients feed the AI model. Live with ISRO tokens; physically-plausible 'modelled' fallback otherwise."],
  ["Phase 9 — SAPTHARA integration", "Wire the real frontend to the backend.", "Swapped Mock repositories for Api repositories: routes←/routing, alerts←/hazards+socket, reports→/reports (ledger-anchored), SOS→/emergency/sms, verification←ledger hash. Added real flutter_map, live-socket indicator, toasts, deep-link."],
  ["Phase 10 — Hardening", "Production-shape the backend + app.", "JWT auth + refresh-token rotation + revocation; rate limiting; Socket.IO handshake auth; admin CRUD (users/vehicles) + pagination; migration runner (runs on boot); outbound notification gateway; CI workflow. App: login screen, GPS (geolocator), disk-persisted reports, local notifications, localization foundation, ISRO risk card, alert dedupe."],
  ["Phase 11 — Driver capability in SAPTHARA", "One app for both roles.", "Ported live telemetry streaming (GPS every 5s → /telemetry/batch) with offline cache + sync and a 'Go online' toggle, so the same phone appears as a live moving vehicle on the dashboard while also filing reports and SOS."],
  ["Phase 12 — PS-26002 completeness pass", "Close every remaining requirement.", "Added: real camera/gallery PHOTO capture in field reports (req f); DISTRICT connectivity endpoint + dashboard panel with delayed-delivery detection and delivery:delayed alerts (req e,g); MULTILINGUAL UI (English/Hindi/Assamese/Bengali) with a Settings language switcher (req h); and MULTI-HAZARD prediction — flood + congestion + roadblock (road-damage) hazard types alongside landslide, each surfaced on the dashboard's Multi-Hazard Risk card (req b). Flood + landslide models retrained on NER-specific real data."],
];
phases.forEach(([t, why, how]) => {
  c.push(H3(t));
  c.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Why: ", bold: true }), new TextRun(why)] }));
  c.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "How: ", bold: true }), new TextRun(how)] }));
});

// 3. Architecture
c.push(H1("3. Architecture & Data Flows"));
c.push(P("Three layers: Edge (SAPTHARA on phones), Core (Node API + PostGIS + Redis + FastAPI), Command (React dashboard)."));
c.push(H2("Key data flows (trace these to understand the whole system)"));
c.push(B("Live tracking: ", "SAPTHARA captures GPS → POST /telemetry/batch → backend updates the vehicle's last_location and emits fleet:update over Socket.IO → the dashboard moves the truck marker. Offline, points cache on the phone and flush (dedup-safe) on reconnect."));
c.push(B("Geofence breach: ", "an ingested telemetry point inside a hazard polygon (ST_Contains) → backend emits hazard:breach → dashboard turns the polygon red + toast/notification on the phone."));
c.push(B("SOS: ", "phone SOS → POST /emergency/sms (Base64 frame) → backend decodes, stores an incident, anchors it to the ledger, emits emergency:alert → dashboard shows a pulsing SOS ping; the phone shows a toast (tap → map deep-link)."));
c.push(B("Rerouting: ", "POST /routing/route → Dijkstra over the PostGIS road graph (21 NER cities, real road geometry) with hazard-penalised edges → returns recommended (safe) + direct routes as GeoJSON, stitched from the real road-following edge polylines → drawn as real curved roads on both the app and dashboard maps."));
c.push(B("Satellite risk: ", "app/dashboard → GET /geo/risk → backend queries MOSDAC/CartoDEM/Bhuvan → feeds the FastAPI model → returns fused risk + action."));

// 4. Backend deep dive
c.push(H1("4. Backend — Structure & How It Works"));
c.push(H2("4.1 Folder structure (node-api/src)"));
[
  ["config/", "env, db (pg pool), redis, socket (Socket.IO + auth)"],
  ["middleware/", "errorHandler (central), validate (Zod), requireAuth/requireRole (JWT)"],
  ["routes/", "one file per resource; index.ts mounts them under /api/v1"],
  ["controllers/", "thin HTTP handlers — parse request, call service, send JSON"],
  ["services/", "business logic (telemetry, hazard, emergency, routing, ledger, geo, auth, report, notification)"],
  ["repositories/", "all SQL — the only layer that talks to PostGIS"],
  ["schemas/", "Zod request validators"],
  ["utils/", "AppError, asyncHandler, auth (bcrypt/JWT), hashChain, dijkstra, pagination"],
  ["migrate.ts", "forward-only migration runner (runs on boot)"],
].forEach(([f, d]) => c.push(li([mono(f), new TextRun("  — " + d)])));
c.push(H2("4.2 The request lifecycle (how a call is served)"));
c.push(num("Route matches (e.g. POST /api/v1/telemetry/batch).", "life"));
c.push(num("validate(schema) checks the body with Zod → 422 if bad.", "life"));
c.push(num("requireAuth runs on protected routes (trips, admin, ledger append).", "life"));
c.push(num("Controller calls a Service function.", "life"));
c.push(num("Service runs logic and calls a Repository for SQL.", "life"));
c.push(num("Any thrown error is caught by asyncHandler → central errorHandler → consistent JSON (400/401/404/409/422/500).", "life"));
c.push(H2("4.3 Endpoints"));
c.push(table(["Endpoint", "Auth", "Purpose"], [
  ["POST /auth/register · /login · /refresh · /logout · GET /me", "public / me:JWT", "Accounts + token rotation"],
  ["POST /telemetry/batch · /relay", "public", "Offline bulk sync · BLE relay"],
  ["GET/POST /hazards, /nearby, /contains, /risk", "public", "Geofencing + AI risk"],
  ["POST /emergency/sms", "public", "SOS webhook"],
  ["GET /fleet", "public", "Vehicles + positions"],
  ["POST/GET/PATCH /trips, /trips/:id/track", "JWT", "Trips + breadcrumb"],
  ["GET/POST /ledger, /ledger/verify", "append:JWT", "Tamper-evident ledger"],
  ["GET /geo/context · /risk · /layers · /connectivity", "public", "ISRO feeds · multi-hazard risk · district status"],
  ["POST /predict · /predict/flood · /predict/congestion (AI svc)", "internal", "Landslide · flood · congestion models"],
  ["POST /routing/route", "public", "Hazard-aware reroute"],
  ["POST/GET /reports", "public", "Field reports (ledger-anchored)"],
  ["/admin/users, /admin/vehicles (CRUD)", "admin JWT", "Administration"],
], [5000, 1400, 2960]));
c.push(H2("4.4 Database tables (PostGIS)"));
["users, vehicles, trips", "telemetry (GEOGRAPHY point; UNIQUE(vehicle_id,timestamp))", "hazards (GEOMETRY polygon + GiST index)", "emergency_incidents", "audit_ledger (hash chain)", "field_reports", "road_nodes / road_edges (routing graph)", "refresh_tokens, schema_migrations"].forEach((t) => c.push(li(t)));
c.push(H2("4.5 Real-time (Socket.IO) events"));
c.push(li([mono("fleet:update"), new TextRun("  — latest position per vehicle (moves dashboard trucks)")]));
c.push(li([mono("hazard:breach"), new TextRun("  — a vehicle entered a hazard polygon")]));
c.push(li([mono("emergency:alert"), new TextRun("  — an SOS was received")]));

// 5. Frontend deep dive
c.push(H1("5. SAPTHARA App — Structure & How It Works"));
c.push(H2("5.1 Clean architecture (lib/)"));
[
  ["domain/entities", "plain data classes (RouteOption, HazardAlert, FieldReport, …)"],
  ["domain/repositories", "abstract interfaces (the 'contract')"],
  ["data/repositories", "Api*Repository (real backend) + Mock* (offline demo); providers pick via kUseBackend"],
  ["core/network", "ApiConfig (backend URL), ApiClient (http + JWT)"],
  ["core/location", "LocationService (geolocator GPS)"],
  ["core/storage", "LocalStore (shared_preferences)"],
  ["core/notifications", "NotificationService (local notifications)"],
  ["services/websocket", "SocketService (Socket.IO client)"],
  ["app/providers.dart", "Riverpod state (routes, alerts, reports, sync, telemetry, socket, focus)"],
  ["app/auth.dart", "login / guest / logout"],
  ["app/telemetry.dart", "driver telemetry streaming controller"],
  ["presentation/", "screens (home, route, report, settings, profile, auth) + widgets"],
].forEach(([f, d]) => c.push(li([mono(f), new TextRun("  — " + d)])));
c.push(H2("5.2 The 'swap Mock → Api' seam"));
c.push(P([new TextRun("Every screen depends on an abstract repository, not on the backend. "), mono("app/providers.dart"), new TextRun(" chooses the implementation with the const "), mono("kUseBackend"), new TextRun(". Set it to false to run the whole app on built-in mock data with no backend — useful for offline demos.")]));
c.push(H2("5.3 Key features → files"));
c.push(table(["Feature", "Where it lives"], [
  ["Live GPS streaming (driver)", "app/telemetry.dart + widgets/live_tracking_card.dart"],
  ["Routes on the map", "data/repositories/api_repositories.dart (ApiRouteRepository) + widgets/live_map.dart"],
  ["Hazard alerts + live socket", "ApiAlertRepository + services/websocket/socket_service.dart"],
  ["SOS", "widgets/sos_flow.dart → POST /emergency/sms"],
  ["ISRO risk card", "widgets/satellite_risk_card.dart → GET /geo/risk"],
  ["Toasts + deep-link", "widgets/alert_toast.dart + navigation/app_shell.dart"],
  ["Login / guest", "presentation/auth/login_screen.dart + app/auth.dart"],
  ["Photo capture in reports", "presentation/report/report_screen.dart (image_picker → camera/gallery)"],
  ["Multilingual (en/hi/as/bn)", "core/i18n/i18n.dart + Settings language switcher; used in app_shell/home/report"],
  ["Backend URL setting", "presentation/settings/settings_screen.dart + core/network/api_config.dart"],
], [3400, 5960]));

// 6. Dashboard + simulator
c.push(H1("6. Dashboard & Simulator"));
c.push(B("Dashboard (dashboard/src): ", "App.tsx wires REST bootstrap + Socket.IO; components/FleetMap.tsx is the MapLibre map (trucks, hazards, routes, SOS pings; keepAlive repaint so tiles always render); AlertsFeed (SOS/breach/delayed), ConnectivityPanel (district-wise status + delayed deliveries), SatelliteRiskCard (Multi-Hazard: landslide/flood/congestion), LedgerPanel, StatBar (incl. Delayed count); LoginGate gates the app; auth.ts stores the JWT."));
c.push(B("Simulator (simulator/simulate.js): ", "seeds vehicles, plants the Sela hazard, streams telemetry batches, fires a scripted SOS. Run it to make the dashboard come alive without a phone."));

// 7. Running
c.push(H1("7. How to Run Everything"));
c.push(H2("7.1 Backend (all services)"));
c.push(P("Start Docker Desktop, then from the project root:"));
c.push(code("docker compose up -d --build"));
c.push(P([new TextRun("Verify: "), mono("curl http://localhost:8080/api/v1/health"), new TextRun(". Tests: "), mono("cd node-api && npm test"), new TextRun(".")]));
c.push(note("If 'docker' is not recognised, prepend %LOCALAPPDATA%\\Programs\\DockerDesktop\\resources\\bin to PATH."));
c.push(H2("7.2 Dashboard + simulator"));
c.push(code("cd dashboard && npm run dev        # http://localhost:5173"));
c.push(code("cd simulator && node simulate.js   # streams virtual trucks"));
c.push(H2("7.3 Install SAPTHARA on your phone (real device)"));
c.push(num("Copy app-release.apk to the phone and install it (allow 'install from unknown sources').", "phone"));
c.push(num("Put the phone on the SAME Wi-Fi as the PC running the backend.", "phone"));
c.push(num("Find the PC's LAN IP: run 'ipconfig' → IPv4 Address (e.g. 192.168.1.10).", "phone"));
c.push(num("Allow port 8080 through Windows Firewall (inbound rule for TCP 8080).", "phone"));
c.push(num("Open the app → Settings → Backend Server → enter http://<PC-IP>:8080 → Save → restart the app.", "phone"));
c.push(num("Sign in or 'Continue as guest'. Toggle 'Live Tracking' on to appear on the dashboard.", "phone"));
c.push(note("Why the URL step: a phone's 'localhost' is the phone itself; it must reach the PC by its LAN IP. The in-app setting means one APK works on any network."));

// 8. Manual changes
c.push(H1("8. How to Change It Yourself (Practical)"));
c.push(note("Each task lists the exact file(s) to edit. After backend edits: rebuild with 'docker compose up -d --build node-api'. After app edits: 'flutter build apk --release'."));
const changes = [
  ["Change the demo route (origin/destination)", "Dashboard: dashboard/src/api.ts (ROUTE_ORIGIN/ROUTE_DEST). App corridor: api_config.dart (originLat/Lng, destLat/Lng). The routing works between any of the 21 NER cities already in the graph."],
  ["Add NER cities / real road geometry to the graph", "Edit NODES + EDGES in gen_ner_roads.js, run 'node gen_ner_roads.js' (fetches real road shapes from OSRM once → road_seed.sql), then apply it to the DB (docker cp + psql) and/or paste into init-db.sql for fresh installs. All offline afterwards."],
  ["Add / move a hazard zone", "POST /api/v1/hazards with a polygon ring, OR edit the seed in init-db.sql. It instantly affects geofencing + rerouting."],
  ["Add a new backend endpoint", "Create schemas/x.schema.ts, repositories/x.repository.ts, services/x.service.ts, controllers/x.controller.ts, routes/x.routes.ts, then mount it in routes/index.ts."],
  ["Change the AI risk formula", "ai-service/main.py — the heuristic weights + blend. Rebuild: docker compose up -d --build ai-service."],
  ["Retrain the AI models on real data", "cd ai-service; pip install -r requirements-train.txt. Landslide (NER): python train.py --ner-only. Flood (NER, India Flood Inventory): python train_flood.py --ifi. Congestion: python train_congestion.py. Fast landslide refit, no network: python train.py --from-csv model/training_data.csv. Then rebuild: docker compose up -d --build ai-service. See ai-service/README_ML.md."],
  ["Change telemetry stream rate", "saptahara .../app/telemetry.dart — the _interval constant (default 5s)."],
  ["Change map tiles / style", "App: widgets/live_map.dart (_tileUrl). Dashboard: components/FleetMap.tsx (the raster tiles URL)."],
  ["Change app colors / theme", "saptahara .../core/theme/app_theme.dart (AppColors)."],
  ["Add a new screen/tab", "Create presentation/<name>/<name>_screen.dart, add it to navigation/app_shell.dart (_screens + _items)."],
  ["Point the app at a different backend", "In-app: Settings → Backend URL. Or at build: flutter build apk --dart-define=API_BASE_URL=http://IP:8080."],
  ["Turn ISRO feeds live", "Set BHUVAN_TOKEN / MOSDAC_TOKEN / CARTODEM_TOKEN in docker-compose.yml (node-api), rebuild."],
  ["Enable real SMS to responders", "Set SMS_WEBHOOK_URL (e.g. Twilio) in docker-compose.yml, rebuild."],
];
changes.forEach(([t, how]) => { c.push(H3(t)); c.push(P(how)); });

// 9. Judges
c.push(H1("9. Explaining It to Judges (Prep)"));
c.push(H2("9.1 One-line pitch"));
c.push(P("\"An edge-first, spatially-aware logistics platform for the North East: phones keep working in dead zones, PostGIS geofencing + a Dijkstra reroute engine steer trucks around live landslide zones, a multi-tier SOS (data → 2G SMS → BLE mesh) always gets a distress signal out, and every emergency is anchored to a tamper-evident ledger — all visible live on an authority dashboard.\""));
c.push(H2("9.2 Likely questions & honest answers"));
const qa = [
  ["Is it really offline-first?", "Yes — telemetry caches to the phone and flushes on reconnect; dedup is enforced by a DB unique key so re-uploads never duplicate. SOS has data/SMS/BLE fallbacks."],
  ["Is the rerouting real or fake?", "Real: a Dijkstra shortest-path over a road graph in PostGIS, where edges crossing an active hazard polygon (ST_Intersects) are penalised, so the route detours. The graph covers 21 real NER cities (all 8 states) over 21 national highways, and every edge carries real road-following geometry (fetched once from OSRM, baked into the DB) — so routes look like real roads and run fully offline. Scoped to NER on purpose (that's the problem statement); city-street granularity would load full OpenStreetMap via pgRouting (documented)."],
  ["Is it blockchain?", "No — it's a cryptographic hash chain (tamper-evident audit ledger). Same tamper-evidence as a blockchain, but single-writer, not a distributed/consensus network. We describe it honestly."],
  ["Is the ISRO data live?", "The integration is built (Bhuvan/MOSDAC/CartoDEM clients + endpoints). Live data needs ISRO-issued tokens; without them it returns a physically-plausible modelled fallback, clearly labelled per-source."],
  ["Is the AI trained on real data?", "Yes — three models, each on a real dataset, two of them NER-specific. Landslide: NASA Global Landslide Catalog, North-East-India events only, ROC-AUC 0.85. Flood: India Flood Inventory (IMD-sourced), all 8 NER states, district-geocoded, ROC-AUC 0.87 (elevation-dominant — physically correct). Congestion: UCI Metro Traffic, 48k real hourly records, ROC-AUC 0.97 (learned rush-hour patterns). All validated on held-out test sets and blended with physics heuristics + live inputs. Honest caveat: no public NER traffic dataset exists, so congestion uses the US dataset as a pattern proxy; a production build plugs in a live traffic API."],
  ["How does the phone show on the dashboard?", "The app streams GPS → /telemetry/batch → the backend emits fleet:update → the dashboard moves that truck. We demonstrated this live."],
];
qa.forEach(([q, a]) => { c.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Q: " + q, bold: true, color: BLUE })] })); c.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "A: " }), new TextRun(a)] })); });
c.push(H2("9.3 Be honest about boundaries"));
c.push(P("Judges respect candour. Openly state: ISRO tokens / real SMS provider / FCM push / TimescaleDB+Kafka+full-OSM are integration/infra steps that need external accounts or heavier infra — the code paths and docs are ready (docs/SCALING.md)."));

// 10. Glossary
c.push(H1("10. Glossary (Plain English)"));
const gloss = [
  ["PostGIS", "A geographic extension of the PostgreSQL database — lets SQL answer spatial questions (is a point inside a zone, what's within N km, do two lines cross)."],
  ["Geofence", "A virtual boundary (polygon) on the map; entering it triggers an alert."],
  ["ST_Contains / ST_DWithin / ST_Intersects", "PostGIS functions: point-inside-polygon, within-a-distance, and shapes-cross."],
  ["Dijkstra", "A classic algorithm that finds the lowest-cost path through a network of nodes/edges."],
  ["Socket.IO / WebSocket", "A live two-way connection so the server can push updates (moving trucks, alerts) to clients instantly."],
  ["JWT", "A signed token proving who a user is; sent with each request after login."],
  ["Refresh token", "A long-lived, revocable token used to get new short-lived access tokens without re-logging-in."],
  ["Hash chain", "Each record stores a fingerprint (SHA-256) that includes the previous record's fingerprint, so tampering with old data is detectable."],
  ["Riverpod", "The state-management library the Flutter app uses to share data between screens."],
  ["Repository pattern", "Code that isolates data access so the UI doesn't care whether data is mock or from the API."],
  ["Docker Compose", "A tool that starts all backend services together with one command."],
  ["Dedup (ON CONFLICT DO NOTHING)", "A database rule that silently ignores duplicate rows — how re-uploaded offline data stays clean."],
  ["MOSDAC / Bhuvan / CartoDEM", "ISRO data sources: satellite rainfall, thematic maps incl. landslide susceptibility, and a national elevation model."],
];
gloss.forEach(([t, d]) => c.push(new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: t + " — ", bold: true }), new TextRun(d)] })));

// 11. Roadmap
c.push(H1("11. What Remains (Roadmap)"));
c.push(B("Needs your accounts/infra: ", "ISRO tokens; a real SMS provider; FCM push; TimescaleDB + Kafka + full-OSM routing (docs/SCALING.md)."));
c.push(B("Non-blocked engineering: ", "integration tests + a seeded admin login; auto token-refresh in the clients; complete the remaining UI-string translations + accessibility labels (core strings + 4-language switcher already done); deeper supply-chain-gap analytics; a live traffic API for congestion; dashboard history playback; deployment with HTTPS/TLS and secrets management."));
c.push(note("The core platform is feature-complete and demo-ready; the above are production-hardening and enhancements."));

const doc = new Document({
  creator: "SAPTHARA Team", title: "SAPTHARA — Full Technical & Teaching Guide (SIH26002)",
  numbering: { config: [
    { reference: "life", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] },
    { reference: "phone", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] },
  ] },
  styles: { default: { document: { run: { font: "Calibri", size: 21, color: "1F2937" } } } },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } }, children: c }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("SAPTHARA_Technical_Guide.docx", b); console.log("WROTE SAPTHARA_Technical_Guide.docx", b.length, "bytes"); });
