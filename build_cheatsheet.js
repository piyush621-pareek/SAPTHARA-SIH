// One-page printable judging cheat sheet (.docx)
const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle } = require("docx");

const ACCENT = "0B6E4F", DARK = "111827", BLUE = "1D4ED8", RED = "B91C1C", GREY = "6B7280";
const c = [];

const bar = (t) => new Paragraph({ spacing: { before: 130, after: 60 }, shading: { type: ShadingType.CLEAR, fill: ACCENT }, children: [new TextRun({ text: "  " + t, bold: true, color: "FFFFFF", size: 20 })] });
const tight = (children) => new Paragraph({ spacing: { after: 40, line: 240 }, children });
const dot = (children) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 26, line: 232 }, children });

// Title
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [new TextRun({ text: "SAPTHARA — Judging Cheat Sheet", bold: true, size: 30, color: ACCENT })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "SIH 2026 · SIH26002 · NER Smart Logistics & Accessibility Intelligence · Transportation & Logistics", size: 16, color: GREY })] }));

// Pitch
c.push(bar("30-SECOND PITCH"));
c.push(tight([new TextRun({ text: "An edge-first, spatially-aware logistics platform for the North East. Phones keep working in cellular dead zones; three NER-trained AI models predict landslide/flood/congestion; PostGIS geofencing + a Dijkstra reroute engine steer trucks around live hazards on real roads; a multi-tier SOS (data → 2G SMS → BLE mesh) always gets a distress signal out; every emergency is anchored to a tamper-evident hash-chain ledger — all live on an authority dashboard with district-wise connectivity.", size: 18 })]));

// Demo click-path
c.push(bar("LIVE DEMO — EXACT CLICK-PATH"));
c.push(dot([new TextRun({ text: "Before judges arrive: ", bold: true, size: 17 }), new TextRun({ text: "docker compose up -d --build   ·   cd dashboard && npm run dev (open localhost:5173)   ·   phone on same Wi-Fi, backend URL set in Settings.", size: 17 })]));
c.push(dot([new TextRun({ text: "1. ", bold: true, size: 17 }), new TextRun({ text: "Dashboard: point out the live map — trucks, hazard polygons, ledger panel, satellite risk card.", size: 17 })]));
c.push(dot([new TextRun({ text: "2. ", bold: true, size: 17 }), new TextRun({ text: "On phone: toggle 'Live Tracking' ON → your truck appears moving on the dashboard (proves real telemetry).", size: 17 })]));
c.push(dot([new TextRun({ text: "3. ", bold: true, size: 17 }), new TextRun({ text: "Run the simulator (node simulate.js) → a truck enters the Sela hazard → dashboard polygon flags + alert fires.", size: 17 })]));
c.push(dot([new TextRun({ text: "4. ", bold: true, size: 17 }), new TextRun({ text: "Show the reroute (Guwahati-Tawang): red 'Direct' follows real NH-13 through the Sela hazard; green 'Recommended' detours around it (409 vs 445 km) on real curved roads.", size: 17 })]));
c.push(dot([new TextRun({ text: "5. ", bold: true, size: 17 }), new TextRun({ text: "Fire an SOS from the phone → dashboard shows a pulsing SOS ping; phone toast → tap → deep-links to map.", size: 17 })]));
c.push(dot([new TextRun({ text: "6. ", bold: true, size: 17 }), new TextRun({ text: "Click any map point → Multi-Hazard Risk card shows Landslide / Flood / Congestion (3 trained models). Point to the District Connectivity panel (open/at-risk/blocked) + Delayed deliveries.", size: 17 })]));
c.push(dot([new TextRun({ text: "7. ", bold: true, size: 17 }), new TextRun({ text: "On the phone: file a report with a real PHOTO; switch language (Settings) to Assamese/Hindi/Bengali. Then show tamper-evidence: GET /ledger/verify returns valid.", size: 17 })]));

// Q&A two-column-ish
c.push(bar("LIKELY QUESTIONS → HONEST ANSWERS"));
const qa = [
  ["Really offline-first?", "Yes. Telemetry caches on the phone, flushes on reconnect; a DB unique-key makes re-uploads dedup automatically. SOS falls back data→SMS→BLE."],
  ["Is rerouting real?", "Yes — Dijkstra over a PostGIS road graph of 21 real NER cities (all 8 states, 21 highways) with REAL road geometry baked in; edges crossing an active hazard (ST_Intersects) are penalised, so it detours on real roads. NER-scoped by design; fully offline."],
  ["Is it blockchain?", "No — a SHA-256 hash chain (tamper-evident audit ledger). Same tamper-evidence, single-writer, not distributed consensus. We say so honestly."],
  ["Is ISRO data live?", "Integration built (Bhuvan/MOSDAC/CartoDEM). Live needs ISRO tokens; without them it returns a physically-plausible modelled fallback, labelled per source."],
  ["Is the AI trained on real data?", "Yes — 3 models, two NER-specific: Landslide (NASA catalog, NE-India only, AUC 0.85), Flood (India Flood Inventory/IMD, 8 NER states, AUC 0.87), Congestion (UCI traffic, 48k records, AUC 0.97). All held-out validated, blended with physics + live inputs. Honest: no public NER traffic dataset, so congestion uses a US proxy."],
  ["How does the phone show live?", "App GPS → POST /telemetry/batch → backend emits fleet:update over Socket.IO → dashboard moves that truck. Demonstrated live."],
];
qa.forEach(([q, a]) => {
  c.push(new Paragraph({ spacing: { after: 6 }, children: [new TextRun({ text: "Q  ", bold: true, color: BLUE, size: 17 }), new TextRun({ text: q, bold: true, color: BLUE, size: 17 })] }));
  c.push(new Paragraph({ spacing: { after: 34 }, children: [new TextRun({ text: "A  ", bold: true, size: 17 }), new TextRun({ text: a, size: 17 })] }));
});

// Stack + boundaries side by side via table
c.push(bar("STACK & HONEST BOUNDARIES"));
const cell = (children) => new TableCell({ width: { size: 4680, type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 100, right: 100 }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" } }, children });
const cellR = (children) => new TableCell({ width: { size: 4680, type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 100, right: 100 }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children });
const mini = (t, color) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 22 }, children: [new TextRun({ text: t, size: 16, color: color || DARK })] });
c.push(new Table({ columnWidths: [4680, 4680], width: { size: 9360, type: WidthType.DXA }, rows: [new TableRow({ children: [
  cell([
    new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: "Tech stack", bold: true, size: 17, color: ACCENT })] }),
    mini("Backend: Node + Express + TypeScript"),
    mini("DB: PostgreSQL + PostGIS (spatial)"),
    mini("AI: FastAPI — 3 models (landslide/flood/congestion), NER real data"),
    mini("App: Flutter (driver + officer, one app)"),
    mini("Dashboard: React + Vite + MapLibre"),
    mini("Real-time: Socket.IO · Cache: Redis"),
    mini("Infra: Docker Compose · CI: GitHub Actions"),
  ]),
  cellR([
    new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: "Not done (needs YOUR accounts/infra)", bold: true, size: 17, color: RED })] }),
    mini("ISRO tokens for live Bhuvan/MOSDAC/CartoDEM", RED),
    mini("Real SMS provider (e.g. Twilio) for responders", RED),
    mini("FCM push notifications", RED),
    mini("TimescaleDB + Kafka + full-OSM at scale", RED),
    new Paragraph({ spacing: { before: 20, after: 0 }, children: [new TextRun({ text: "Everything else is built, tested (42 backend tests), and demo-ready. Code paths + docs/SCALING.md ready for the above.", italics: true, size: 15, color: GREY })] }),
  ]),
] })] }));

const doc = new Document({
  creator: "SAPTHARA Team", title: "SAPTHARA Judging Cheat Sheet",
  styles: { default: { document: { run: { font: "Calibri", size: 18, color: "1F2937" } } } },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 620, bottom: 500, left: 720, right: 720 } } }, children: c }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("SAPTHARA_Judging_CheatSheet.docx", b); console.log("WROTE SAPTHARA_Judging_CheatSheet.docx", b.length, "bytes"); });
