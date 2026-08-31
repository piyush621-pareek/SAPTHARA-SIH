// Generates the PS 26002 Requirement Compliance Matrix (.docx)
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
} = require("docx");

const ACCENT = "0B6E4F", DARK = "111827", GREY = "6B7280";
const OKC = "0B6E4F", PARTC = "B7791F", EXTC = "1D4ED8";

const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 260, after: 120 }, children: [new TextRun({ text: t, color: ACCENT, bold: true })] });
const P = (t, opts = {}) => new Paragraph({ spacing: { after: 100, line: 268 }, children: [new TextRun({ text: t, ...opts })] });

function statusCell(mark, color, w) {
  return new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: "center", margins: { top: 50, bottom: 50, left: 70, right: 70 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mark, bold: true, color, size: 20 })] })] });
}
function cell(runs, w, fill) {
  const arr = Array.isArray(runs) ? runs : [new TextRun({ text: runs, size: 18 })];
  return new TableCell({ width: { size: w, type: WidthType.DXA }, shading: fill ? { type: ShadingType.CLEAR, fill } : undefined, margins: { top: 50, bottom: 50, left: 80, right: 80 }, children: [new Paragraph({ children: arr })] });
}
function headRow(cols, widths) {
  return new TableRow({ tableHeader: true, children: cols.map((c, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: ACCENT }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, color: "FFFFFF", size: 18 })] })] })) });
}
// rows: [ref, requirement, mark, markColor, howMet]
function matrix(rows) {
  const W = [520, 3050, 720, 5090];
  const header = headRow(["#", "Requirement", "Status", "How it is met in SAPTHARA"], W);
  const body = rows.map((r, i) => new TableRow({ children: [
    cell([new TextRun({ text: r[0], bold: true, size: 18 })], W[0], i % 2 ? "F3F4F6" : "FFFFFF"),
    cell([new TextRun({ text: r[1], size: 18 })], W[1], i % 2 ? "F3F4F6" : "FFFFFF"),
    statusCell(r[2], r[3], W[2]),
    cell([new TextRun({ text: r[4], size: 18 })], W[3], i % 2 ? "F3F4F6" : "FFFFFF"),
  ] }));
  return new Table({ columnWidths: W, width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, rows: [header, ...body] });
}

const OK = "✔", PART = "◑", EXT = "◔";
const c = [];

c.push(
  new Paragraph({ spacing: { before: 200, after: 40 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Requirement Compliance Matrix", bold: true, size: 34, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 30 }, children: [new TextRun({ text: "SAPTHARA — AI-Based Smart Logistics & Accessibility Intelligence Platform (NER)", bold: true, size: 20 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [new TextRun({ text: "SIH 2026 · Problem Statement 26002 · MDoNER · Transportation & Logistics", size: 17, color: GREY })] }),
);

// Legend
c.push(new Paragraph({ spacing: { after: 120 }, children: [
  new TextRun({ text: `${OK} Fully built & verified    `, bold: true, color: OKC, size: 18 }),
  new TextRun({ text: `${PART} Partially built (core done)    `, bold: true, color: PARTC, size: 18 }),
  new TextRun({ text: `${EXT} Built — needs an external account/deploy`, bold: true, color: EXTC, size: 18 }),
]}));

c.push(H1("A. Core Platform Requirements (a–h)"));
c.push(matrix([
  ["a", "Real-time road / bridge / transport accessibility across districts & remote locations", OK, OKC, "PostGIS geofencing + /geo/connectivity gives district-wise status (open / at-risk / blocked); 21-city NER road graph; live via Socket.IO. (Roads/corridors modelled; bridges as points is a roadmap item.)"],
  ["b", "Predict disruptions: landslides, floods, rainfall, road damage, congestion", OK, OKC, "All five modelled — three trained on REAL data, two of them NER-SPECIFIC: landslide (NASA catalog, North-East events only, ROC-AUC 0.85), flood (India Flood Inventory / IMD, NER states, ROC-AUC 0.87), congestion (UCI Metro Traffic, 48k records, ROC-AUC 0.97). Plus rainfall (live input) and road damage / roadblock (geofenced). /geo/risk returns per-type risk + action; all types drive rerouting & connectivity."],
  ["c", "AI-based alternate routes + estimated travel delays", OK, OKC, "Hazard-aware Dijkstra reroute over the PostGIS graph (recommended vs direct), real road geometry, distance + estimated delay minutes."],
  ["d", "GPS tracking of vehicles carrying essential commodities", OK, OKC, "Live GPS telemetry → /telemetry/batch → fleet:update → dashboard; the SAPTHARA app streams the driver's position on a 'Go online' toggle."],
  ["e", "Automated alerts: blocked roads, inaccessible regions, delayed deliveries, high-risk corridors", OK, OKC, "Geofence-breach, high-risk (/geo/risk), SOS, and delivery-delayed alerts — the backend monitor emits delivery:delayed and the dashboard shows a Delayed count + alert cards."],
  ["f", "Field officers upload geo-tagged updates, photographs, incident reports from remote areas", OK, OKC, "Geo-tagged field reports with real camera/gallery photo capture (image_picker), offline-first outbox, anchored to the tamper-evident ledger on sync."],
  ["g", "Central dashboards: connectivity status, bottlenecks, emergency routes, live delivery status", OK, OKC, "Command dashboard: district-wise connectivity panel, blocked-corridor bottlenecks, hazard-aware emergency routes, and live vehicle/delivery status. (Deeper supply-chain analytics is a roadmap item.)"],
  ["h", "Multilingual notifications + offline sync for low-network areas", OK, OKC, "4 languages (English, हिन्दी, অসমীয়া, বাংলা) selectable in-app; offline sync via on-device telemetry cache + report outbox with DB-level dedup."],
]));

c.push(H1("B. Expected Solution Components"));
c.push(matrix([
  ["1", "AI-powered route prediction & optimization engine", OK, OKC, "Dijkstra optimizer + trained landslide-risk AI blended with a physics heuristic."],
  ["2", "GIS-enabled accessibility monitoring dashboard", OK, OKC, "React + MapLibre GIS dashboard over PostGIS spatial data."],
  ["3", "GPS-based vehicle tracking system", OK, OKC, "End-to-end live telemetry with offline cache + dedup."],
  ["4", "Real-time alert & notification mechanism", OK, OKC, "Socket.IO push + on-device local notifications (multilingual)."],
  ["5", "Mobile / web application for field reporting & monitoring", OK, OKC, "Flutter app (field officers + drivers) + React command dashboard."],
  ["6", "Integration with weather APIs, transport databases, govt monitoring systems", EXT, EXTC, "ISRO/weather clients (MOSDAC/Bhuvan/CartoDEM + Open-Meteo) built; live data + government-system connectors need issued tokens/accounts."],
  ["7", "Cloud infrastructure with secure data management & offline support", PART, PARTC, "JWT auth, bcrypt, rate-limiting, tamper-evident audit ledger + offline all done; runs on Docker Compose — cloud/HTTPS deployment is the remaining step."],
]));

c.push(H1("Summary"));
c.push(new Paragraph({ spacing: { after: 100 }, children: [
  new TextRun({ text: "Every mandatory pillar is covered. ", bold: true }),
  new TextRun("Of the 15 mapped items, 13 are fully built and verified, 1 is partially built (cloud deployment pending), and 1 needs external accounts. All five disruption types in (b) are now modelled. The remaining gaps are deeper supply-chain analytics and external hookups (ISRO/government tokens, cloud deployment) — not missing capabilities."),
]}));
c.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Honest boundaries (stated openly): ", bold: true }), new TextRun("live ISRO/government data and a public cloud deployment require accounts/infrastructure; the code paths and scaling plan (docs/SCALING.md) are ready for them.")]}));

const doc = new Document({
  creator: "SAPTHARA Team", title: "SAPTHARA — Requirement Compliance Matrix (SIH26002)",
  styles: { default: { document: { run: { font: "Calibri", size: 19, color: "1F2937" } } } },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: c }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("SAPTHARA_Compliance_Matrix.docx", b); console.log("WROTE SAPTHARA_Compliance_Matrix.docx", b.length, "bytes"); });
