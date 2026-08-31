// Generates the Command Dashboard features document (.docx) for the team.
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, PageBreak,
} = require("docx");

const ACCENT = "0B6E4F", DARK = "111827", BLUE = "1D4ED8", GREY = "6B7280";
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 130 }, children: [new TextRun({ text: t, color: ACCENT, bold: true })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 80 }, children: [new TextRun({ text: t, color: DARK, bold: true })] });
const P = (t) => new Paragraph({ spacing: { after: 110, line: 276 }, children: typeof t === "string" ? [new TextRun(t)] : t });
const B = (l, r) => new Paragraph({ spacing: { after: 100, line: 276 }, children: [new TextRun({ text: l, bold: true }), new TextRun(r)] });
const li = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 50, line: 264 }, children: typeof t === "string" ? [new TextRun(t)] : t });
const mono = (t) => new TextRun({ text: t, font: "Consolas", size: 18 });

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const hdr = new TableRow({ tableHeader: true, children: headers.map((h, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: ACCENT }, margins: { top: 50, bottom: 50, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18 })] })] })) });
  const body = rows.map((r, ri) => new TableRow({ children: r.map((c, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: ri % 2 ? "F3F4F6" : "FFFFFF" }, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: c, size: 18 })] })] })) }));
  return new Table({ columnWidths: widths, width: { size: total, type: WidthType.DXA }, rows: [hdr, ...body] });
}

const c = [];
c.push(
  new Paragraph({ spacing: { before: 1400, after: 60 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SAPTHARA Command Dashboard", bold: true, size: 40, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: "Full Feature Guide — What Every Part Does", bold: true, size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "SIH 2026 · SIH26002 · NER Smart Logistics · Authority Control Room", size: 20, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "For the team — read this, then redesign the look & feel to feel more human.", italics: true, size: 19, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

c.push(H1("1. What the Dashboard Is"));
c.push(P("The Command Dashboard is the authority-side control room (a web app for a district officer / MDoNER control centre). While the phone app (SAPTHARA) is used by drivers and field officers on the ground, the dashboard is where supervisors WATCH the whole North-East region live: every vehicle, every hazard, every SOS, every blocked district — updating in real time."));
c.push(B("Runs at: ", "http://localhost:5173 (dev). It talks to the same backend as the phone app (port 8080) over REST + a live Socket.IO connection."));
c.push(B("Tech stack: ", "React + Vite + TypeScript (UI), MapLibre GL (the interactive map), Socket.IO client (live updates), plain CSS (styles.css). No heavy UI framework — easy to restyle."));

c.push(H1("2. Screen Layout (what you see)"));
c.push(P("The screen is one full-height command view with four zones:"));
c.push(table(["Zone", "Where", "What it shows"], [
  ["Top status bar", "full width, top", "Live counters + connection status"],
  ["Fleet sidebar", "left column", "The list of all vehicles"],
  ["Map", "big centre", "The live map of the whole region"],
  ["Right column", "right side", "Alerts feed · District connectivity · Audit ledger (stacked)"],
], [1900, 2200, 5260]));

c.push(H1("3. Every Feature — What It Does"));

c.push(H2("3.1 Login Gate"));
c.push(B("What it does: ", "Shows an 'Authority sign-in' screen before the dashboard opens. The operator signs in with phone + password, or clicks 'Continue as guest (read-only)'. The login token is kept so the session persists."));
c.push(B("File: ", "components/LoginGate.tsx + auth.ts"));

c.push(H2("3.2 Top Status Bar"));
c.push(B("What it does: ", "Five live counters that update instantly as things happen: "));
c.push(li([new TextRun({ text: "ACTIVE ", bold: true }), new TextRun("— how many vehicles are online (e.g. 4/6).")]));
c.push(li([new TextRun({ text: "HAZARDS ", bold: true }), new TextRun("— active danger zones (landslide, flood, roadblock, congestion).")]));
c.push(li([new TextRun({ text: "BREACHES ", bold: true }), new TextRun("— vehicles that have driven into a hazard zone.")]));
c.push(li([new TextRun({ text: "DELAYED ", bold: true }), new TextRun("— deliveries flagged as delayed (lost contact or blocked).")]));
c.push(li([new TextRun({ text: "SOS ", bold: true }), new TextRun("— active emergency distress signals.")]));
c.push(li([new TextRun({ text: "SOCKET LIVE ", bold: true }), new TextRun("— a green pill confirming the real-time connection is up.")]));
c.push(B("File: ", "components/StatBar.tsx"));

c.push(H2("3.3 Fleet Sidebar (left)"));
c.push(B("What it does: ", "Lists every vehicle with its live speed and its location shown as a PLACE NAME (e.g. 'near Dirang', not raw coordinates). A green dot = moving, grey = idle. Click any vehicle → the map flies to it."));
c.push(B("File: ", "components/FleetSidebar.tsx (uses places.ts for names)"));

c.push(H2("3.4 The Live Map (centre) — the heart of the dashboard"));
c.push(B("What it does: ", "A real OpenStreetMap view of the North-East, tilted in 3D like a command table. It draws, all live:"));
c.push(li("Trucks — moving markers with their number plate, rotating to face their heading."));
c.push(li("Hazard zones — coloured polygons (orange = warning, red = a vehicle has breached it)."));
c.push(li("Routes — the recommended SAFE route in green, the direct/dangerous route in red-dashed, drawn on the real curved roads."));
c.push(li("SOS pings — a pulsing red marker exactly where an emergency was raised."));
c.push(li([new TextRun("Click anywhere on the map → it queries the "), new TextRun({ text: "Multi-Hazard Risk", bold: true }), new TextRun(" for that spot (see 3.5).")]));
c.push(B("File: ", "components/FleetMap.tsx"));

c.push(H2("3.5 Multi-Hazard Risk Card"));
c.push(B("What it does: ", "When you click a point on the map, this card shows the AI risk for that location across THREE disruption types — Landslide, Flood, Congestion — each with a % and an action (PROCEED / CAUTION / REROUTE / HALT). It also shows the inputs (rainfall, soil moisture, slope, elevation) and whether each ISRO feed is LIVE or modelled."));
c.push(B("File: ", "components/SatelliteRiskCard.tsx"));

c.push(H2("3.6 District Connectivity Panel"));
c.push(B("What it does: ", "The 'district-wise connectivity status' the problem statement asks for. It lists NER districts/cities and marks each Open (green), At-risk (amber), or Blocked (red) based on whether hazards are cutting their roads. It also lists delayed deliveries. This is the 'logistics bottlenecks' view for a supervisor."));
c.push(B("File: ", "components/ConnectivityPanel.tsx (data from GET /geo/connectivity)"));

c.push(H2("3.7 Live Alerts Feed (right)"));
c.push(B("What it does: ", "A running feed of every live event — SOS distress, geofence breaches, delayed deliveries — newest first, each stamped with time + vehicle. Click an alert → the map flies to its location. SOS cards flash red."));
c.push(B("File: ", "components/AlertsFeed.tsx"));

c.push(H2("3.8 Audit Ledger Panel"));
c.push(B("What it does: ", "Shows the tamper-evident audit trail — each emergency/report is a hash-chained entry (#7 ← prev #6 …). A 'VERIFIED' badge means the whole chain checks out (any tampering with old records would be detected). This is the trust/accountability feature for a government reviewer."));
c.push(B("File: ", "components/LedgerPanel.tsx"));

c.push(H1("4. How It Updates Live (for the developers)"));
c.push(P("The dashboard opens one Socket.IO connection to the backend and listens for events. When the backend emits, the UI updates with no refresh:"));
c.push(li([mono("fleet:update"), new TextRun(" → move the truck markers + sidebar speeds.")]));
c.push(li([mono("hazard:breach"), new TextRun(" → light the hazard polygon red + add a feed alert.")]));
c.push(li([mono("emergency:alert"), new TextRun(" → drop an SOS ping + feed alert.")]));
c.push(li([mono("delivery:delayed"), new TextRun(" → bump the DELAYED counter + feed alert.")]));
c.push(P([new TextRun("On load it also fetches the starting data over REST: "), mono("/fleet"), new TextRun(", "), mono("/hazards"), new TextRun(", "), mono("/routing/route"), new TextRun(", "), mono("/ledger"), new TextRun(", "), mono("/geo/connectivity"), new TextRun(". All wiring lives in "), mono("App.tsx"), new TextRun(" and "), mono("api.ts"), new TextRun(".")]));

c.push(H1("5. File Map (so the team knows where to edit)"));
c.push(table(["File", "Responsibility"], [
  ["src/App.tsx", "Top-level wiring: REST bootstrap + all Socket.IO listeners + layout"],
  ["src/api.ts", "All REST calls to the backend"],
  ["src/socket.ts", "Creates the Socket.IO connection"],
  ["src/auth.ts", "Login token storage + auth header"],
  ["src/types.ts", "Shared TypeScript types"],
  ["src/places.ts", "NER place-name lookup (coords → 'near Dirang')"],
  ["src/styles.css", "ALL styling — edit this to restyle the whole dashboard"],
  ["components/StatBar.tsx", "Top counters + connection pill"],
  ["components/FleetSidebar.tsx", "Left vehicle list"],
  ["components/FleetMap.tsx", "The MapLibre map + all overlays"],
  ["components/SatelliteRiskCard.tsx", "Multi-hazard risk card"],
  ["components/ConnectivityPanel.tsx", "District connectivity + delayed deliveries"],
  ["components/AlertsFeed.tsx", "Live alerts feed"],
  ["components/LedgerPanel.tsx", "Audit ledger"],
  ["components/LoginGate.tsx", "Authority sign-in gate"],
], [3300, 6060]));

c.push(H1("6. Making It Feel More Human (for the team)"));
c.push(P("The logic is solid; the look can be warmer and more branded. Concrete, low-risk ideas — all in styles.css (colours/spacing) and the component JSX (labels/copy):"));
c.push(li("Branding: add a real logo + product name lockup in the top-left; pick a 2-colour brand palette and set it as CSS variables in styles.css (they're already variables)."));
c.push(li("Warmer copy: replace terse labels with human phrasing — 'Everything looks clear' when 0 alerts; 'Convoy Bravo is 8 km from Dirang, moving 45 km/h' in the sidebar."));
c.push(li("Empathy in alerts: SOS cards could say 'Driver needs help near Sela Pass — tap to locate' rather than a raw code."));
c.push(li("Onboarding: a first-visit tooltip tour ('This is your fleet · click the map for risk · red = danger')."));
c.push(li("Human touches: operator name + shield avatar top-right; a subtle last-updated 'a few seconds ago'; friendly empty states with an illustration."));
c.push(li("Accessibility: larger tap targets, high-contrast mode, and Hindi/Assamese labels (the phone app already has these strings to reuse)."));
c.push(li("Motion: gentle fade-ins for new alerts instead of hard pops; a soft pulse on the SOS."));
c.push(P([new TextRun({ text: "Where to start: ", bold: true }), new TextRun("open src/styles.css (it uses CSS variables at the top — change those first for an instant new palette), then soften the wording in StatBar.tsx / AlertsFeed.tsx / FleetSidebar.tsx.")]));

c.push(H1("7. How to Run It"));
c.push(P([mono("cd dashboard"), new TextRun("  →  "), mono("npm install"), new TextRun("  →  "), mono("npm run dev"), new TextRun("  → open http://localhost:5173")]));
c.push(P("The backend must be running (docker compose up -d) for live data. Sign in as guest to view read-only, or with an account."));

const doc = new Document({
  creator: "SAPTHARA Team", title: "SAPTHARA Command Dashboard — Feature Guide",
  styles: { default: { document: { run: { font: "Calibri", size: 21, color: "1F2937" } } } },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } }, children: c }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("SAPTHARA_Dashboard_Features.docx", b); console.log("WROTE SAPTHARA_Dashboard_Features.docx", b.length); });
