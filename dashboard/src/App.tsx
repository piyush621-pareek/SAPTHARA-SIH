import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { createSocket } from "./socket";
import {
  fetchFleet,
  fetchHazards,
  fetchGeoRisk,
  fetchLedger,
  fetchLedgerVerify,
  fetchRoute,
  fetchConnectivity,
} from "./api";
import type {
  FleetVehicle,
  FleetPosition,
  HazardFeature,
  HazardBreach,
  EmergencyAlert,
  FeedItem,
  GeoRisk,
  LedgerEntry,
  LedgerVerify,
  RouteResult,
  ConnectivityData,
  DeliveryDelayedEvent,
} from "./types";
import FleetMap from "./components/FleetMap";
import FleetSidebar from "./components/FleetSidebar";
import AlertsFeed from "./components/AlertsFeed";
import StatBar from "./components/StatBar";
import SatelliteRiskCard from "./components/SatelliteRiskCard";
import LedgerPanel from "./components/LedgerPanel";
import ConnectivityPanel from "./components/ConnectivityPanel";

const BREACH_HOLD_MS = 20_000; // how long a geofence stays lit red after a breach
const MAX_FEED = 40;

export default function App() {
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [hazards, setHazards] = useState<HazardFeature[]>([]);
  const [positions, setPositions] = useState<Record<string, FleetPosition>>({});
  const [breached, setBreached] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [sosPings, setSosPings] = useState<
    Array<{ id: string; latitude: number; longitude: number }>
  >([]);
  const [connected, setConnected] = useState(false);
  // Which slide-in panel is shown on narrow / mobile screens.
  const [mobilePanel, setMobilePanel] = useState<"fleet" | "ops" | null>(null);
  const [focus, setFocus] = useState<{
    longitude: number;
    latitude: number;
    nonce: number;
  } | null>(null);

  // Satellite risk (ISRO) + ledger state
  const [satRisk, setSatRisk] = useState<GeoRisk | null>(null);
  const [satLoading, setSatLoading] = useState(false);
  const [satPoint, setSatPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerVerify, setLedgerVerify] = useState<LedgerVerify | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityData | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const breachTimers = useRef<Map<string, number>>(new Map());
  const regByVehicle = useRef<Map<string, string>>(new Map());

  const focusOn = (lng: number, lat: number) =>
    setFocus({ longitude: lng, latitude: lat, nonce: Date.now() });

  // Clicking the map queries the ISRO-fused satellite risk for that point.
  async function handleMapClick(lng: number, lat: number) {
    setSatPoint({ lat, lng });
    setSatLoading(true);
    setSatRisk(null);
    try {
      const risk = await fetchGeoRisk(lat, lng);
      setSatRisk(risk);
    } catch {
      setSatRisk(null);
    } finally {
      setSatLoading(false);
    }
  }

  async function refreshLedger() {
    try {
      const [entries, verify] = await Promise.all([
        fetchLedger(),
        fetchLedgerVerify(),
      ]);
      setLedger(entries);
      setLedgerVerify(verify);
    } catch {
      /* backend may be momentarily unavailable */
    }
  }

  // Bootstrap: initial fleet + hazards.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [f, h] = await Promise.all([fetchFleet(), fetchHazards()]);
        if (cancelled) return;
        setFleet(f);
        setHazards(h);
        for (const v of f) regByVehicle.current.set(v.id, v.registration);
        // Seed positions from any known last-location.
        const seed: Record<string, FleetPosition> = {};
        for (const v of f) {
          if (v.latitude != null && v.longitude != null) {
            seed[v.id] = {
              vehicleId: v.id,
              latitude: v.latitude,
              longitude: v.longitude,
              speedKmph: null,
              headingDeg: null,
              at: v.last_seen_at ?? new Date().toISOString(),
            };
          }
        }
        setPositions(seed);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("bootstrap failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Socket.IO live wiring.
  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("delivery:delayed", (e: DeliveryDelayedEvent) => {
      pushFeed({
        id: `delay-${e.vehicle_id}-${Math.round(e.ts / 10000)}`,
        kind: "delivery",
        title: `Delivery delayed: ${e.registration}`,
        detail: `${e.reason} · est. +${e.estimated_delay_min} min`,
        vehicle: e.registration,
        at: new Date(e.ts).toISOString(),
        location: {
          latitude: e.latitude ?? 0,
          longitude: e.longitude ?? 0,
        },
      });
    });

    socket.on("fleet:update", (payload: { positions: FleetPosition[] }) => {
      setPositions((prev) => {
        const next = { ...prev };
        for (const p of payload.positions) next[p.vehicleId] = p;
        return next;
      });
    });

    socket.on("hazard:breach", (b: HazardBreach) => {
      const reg = b.vehicleId
        ? regByVehicle.current.get(b.vehicleId) ?? b.vehicleId.slice(0, 8)
        : "unknown";
      const labels = b.hazards.map((h) => h.label).join(", ");
      pushFeed({
        id: `breach-${b.vehicleId}-${b.at}`,
        kind: "breach",
        title: `Geofence breach: ${labels}`,
        detail: `${reg} entered an active hazard zone.`,
        vehicle: reg,
        at: b.at,
        location: b.location,
      });
      // Light the breached hazards red, then auto-clear.
      setBreached((prev) => {
        const next = new Set(prev);
        for (const h of b.hazards) next.add(h.id);
        return next;
      });
      for (const h of b.hazards) {
        const existing = breachTimers.current.get(h.id);
        if (existing) window.clearTimeout(existing);
        const t = window.setTimeout(() => {
          setBreached((prev) => {
            const next = new Set(prev);
            next.delete(h.id);
            return next;
          });
          breachTimers.current.delete(h.id);
        }, BREACH_HOLD_MS);
        breachTimers.current.set(h.id, t);
      }
    });

    socket.on("emergency:alert", (a: EmergencyAlert) => {
      const reg = a.vehicleId
        ? regByVehicle.current.get(a.vehicleId) ?? a.vehicleId.slice(0, 8)
        : a.channel;
      const inside = a.insideHazards?.length
        ? ` · inside ${a.insideHazards.map((h) => h.label).join(", ")}`
        : "";
      pushFeed({
        id: `sos-${a.incidentId}`,
        kind: "sos",
        title: a.message || "SOS distress signal",
        detail: `${reg} via ${a.channel.toUpperCase()}${inside}`,
        vehicle: reg,
        at: a.at,
        location: a.location,
      });
      setSosPings((prev) =>
        [
          {
            id: a.incidentId,
            latitude: a.location.latitude,
            longitude: a.location.longitude,
          },
          ...prev,
        ].slice(0, 8)
      );
      // Draw operator attention to the distress location.
      focusOn(a.location.longitude, a.location.latitude);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  // Poll the audit ledger + chain verification (new SOS records appear here).
  useEffect(() => {
    refreshLedger();
    const t = setInterval(refreshLedger, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the hazard-aware route so the map re-draws the detour when a hazard
  // geofence activates (or clears).
  useEffect(() => {
    const load = async () => {
      try {
        setRoute(await fetchRoute());
      } catch {
        /* backend momentarily unavailable */
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  // Poll district-wise connectivity + delivery statuses.
  useEffect(() => {
    const load = async () => {
      try {
        setConnectivity(await fetchConnectivity());
      } catch {
        /* backend momentarily unavailable */
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  function pushFeed(item: FeedItem) {
    setFeed((prev) => [item, ...prev.filter((f) => f.id !== item.id)].slice(0, MAX_FEED));
  }

  const activeTrucks = Object.values(positions).filter(
    (p) => p.speedKmph != null && p.speedKmph > 1
  ).length;
  const sosCount = feed.filter((f) => f.kind === "sos").length;
  const breachCount = feed.filter((f) => f.kind === "breach").length;
  const delayedCount = connectivity?.summary.delayed ?? 0;

  // Live per-vehicle status (by registration) derived from the recent alert
  // feed + connectivity, so the fleet list can show a colour-coded state.
  const statusByReg: Record<string, "sos" | "breach" | "delayed"> = {};
  for (const f of feed) {
    const cur = statusByReg[f.vehicle];
    if (f.kind === "sos") statusByReg[f.vehicle] = "sos";
    else if (f.kind === "breach" && cur !== "sos") statusByReg[f.vehicle] = "breach";
    else if (f.kind === "delivery" && !cur) statusByReg[f.vehicle] = "delayed";
  }
  if (connectivity) {
    for (const d of connectivity.deliveries) {
      if (d.status === "delayed" && !statusByReg[d.registration]) {
        statusByReg[d.registration] = "delayed";
      }
    }
  }

  return (
    <div className="app">
      <StatBar
        connected={connected}
        activeTrucks={activeTrucks}
        totalTrucks={fleet.length}
        hazardCount={hazards.length}
        breachCount={breachCount}
        sosCount={sosCount}
        delayedCount={delayedCount}
        onMenuToggle={() =>
          setMobilePanel((m) => (m === "fleet" ? null : "fleet"))
        }
      />
      <div className="workspace">
        <div className={`mobile-panel fleet-slot ${mobilePanel === "fleet" ? "open" : ""}`}>
          <FleetSidebar
            fleet={fleet}
            positions={positions}
            statusByReg={statusByReg}
            onFocus={(lng, lat) => {
              focusOn(lng, lat);
              setMobilePanel(null);
            }}
          />
        </div>
        <div className="map-wrap">
          <FleetMap
            hazards={hazards}
            fleet={fleet}
            positions={positions}
            breachedHazardIds={breached}
            sosPings={sosPings}
            focus={focus}
            route={route}
            onMapClick={handleMapClick}
          />
          <div className="map-hint">Click anywhere to query 🛰 satellite risk</div>
          {route && (
            <div className={`route-banner ${route.hazard_avoided ? "rerouted" : "clear"}`}>
              <div className="route-legend">
                <span className="rl green">━</span> Recommended
                {route.alternatives.some((a) => a.id === "direct") && (
                  <>
                    <span className="rl red">┄</span> Direct
                  </>
                )}
              </div>
              <div className="route-status">
                {route.hazard_avoided
                  ? `⚠ REROUTED · ${route.distance_km} km · avoided ${route.avoided_hazards.join(", ")}`
                  : `✓ CLEAR ROUTE · ${route.distance_km} km`}
              </div>
            </div>
          )}
          <SatelliteRiskCard
            risk={satRisk}
            loading={satLoading}
            point={satPoint}
            onClose={() => setSatPoint(null)}
          />
        </div>
        <div className={`right-col mobile-panel ops-slot ${mobilePanel === "ops" ? "open" : ""}`}>
          <AlertsFeed feed={feed} onFocus={focusOn} />
          <ConnectivityPanel data={connectivity} onFocus={focusOn} />
          <LedgerPanel entries={ledger} verify={ledgerVerify} />
        </div>
      </div>

      {/* Mobile-only floating toggle for the alerts / districts column. */}
      <button
        className="mobile-fab"
        onClick={() => setMobilePanel((m) => (m === "ops" ? null : "ops"))}
      >
        {mobilePanel === "ops" ? "✕ Close" : "Alerts & Districts"}
      </button>
    </div>
  );
}
