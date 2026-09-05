import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Marker, StyleSpecification } from "maplibre-gl";
import type {
  FleetVehicle,
  FleetPosition,
  HazardFeature,
  RouteResult,
} from "../types";

interface Props {
  hazards: HazardFeature[];
  fleet: FleetVehicle[];
  positions: Record<string, FleetPosition>;
  breachedHazardIds: Set<string>;
  sosPings: Array<{ id: string; latitude: number; longitude: number }>;
  focus: { longitude: number; latitude: number; nonce: number } | null;
  route: RouteResult | null;
  onMapClick?: (lng: number, lat: number) => void;
}

/** FeatureCollection of the route alternatives, tagged by kind for styling. */
function routeFC(route: RouteResult | null): GeoJSON.FeatureCollection {
  if (!route) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: route.alternatives.map((a) => ({
      type: "Feature",
      properties: { kind: a.id, name: a.name },
      geometry: a.geometry,
    })),
  };
}

// Start from an empty, always-valid style and add the raster basemap + hazard
// layers imperatively on `load`. This avoids inline-style edge cases and
// guarantees the source is registered before the layer references it.
const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#e8eef6" } },
  ],
};

const OSM_TILES = [
  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
];

/** Builds a FeatureCollection of hazard polygons, tagging breached ones. */
function hazardFC(
  hazards: HazardFeature[],
  breached: Set<string>
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: hazards.map((h) => ({
      type: "Feature",
      id: h.id,
      properties: {
        id: h.id,
        label: h.label,
        severity: h.severity,
        risk: h.risk_score,
        breached: breached.has(h.id) ? 1 : 0,
      },
      geometry: h.geometry,
    })),
  };
}

function markerEl(reg: string, heading: number | null | undefined, speed?: number | null): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "truck-marker";
  const moving = speed != null && speed > 1;
  el.innerHTML = `
    <div class="truck-arrow ${moving ? "moving" : ""}" style="transform: rotate(${heading ?? 0}deg)">
      <svg width="28" height="28" viewBox="0 0 28 28"><polygon points="14,2 24,24 14,18 4,24" fill="${moving ? "#22c55e" : "#64748b"}" stroke="#fff" stroke-width="1.5"/></svg>
    </div>
    <div class="truck-speed">${speed != null && speed > 0 ? Math.round(speed) + " km/h" : ""}</div>
    <div class="truck-label">${reg}</div>`;
  return el;
}

export default function FleetMap({
  hazards,
  fleet,
  positions,
  breachedHazardIds,
  sosPings,
  focus,
  route,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const sosMarkersRef = useRef<Map<string, Marker>>(new Map());
  const regByVehicle = useRef<Map<string, string>>(new Map());
  // Latest click handler, so the deps-less init effect always calls the current one.
  const onClickRef = useRef<Props["onMapClick"]>(onMapClick);
  onClickRef.current = onMapClick;

  // Init map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: EMPTY_STYLE,
      center: [92.5, 26.5], // North East India
      zoom: 7,
      pitch: 55, // 3D tilt for the command-room perspective
      bearing: -18,
      attributionControl: { compact: true },
      // Keep the last rendered frame in the drawing buffer. Without this the
      // WebGL canvas can composite/appear blank whenever the render loop goes
      // idle (and it makes the basemap capturable in screenshots/thumbnails).
      preserveDrawingBuffer: true,
    });
    // Bottom-right so the zoom / compass controls don't collide with the
    // top-left map toolbar (Plan a trip / Report a hazard).
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    mapRef.current = map;
    (window as unknown as { __map?: MlMap }).__map = map;
    map.on("error", (e) => {
      // eslint-disable-next-line no-console
      console.error("[maplibre error]", (e as unknown as { error?: Error }).error?.message ?? e);
    });
    map.on("click", (e) => {
      onClickRef.current?.(e.lngLat.lng, e.lngLat.lat);
    });
    map.getCanvas().style.cursor = "crosshair";

    map.on("load", () => {
      // Raster basemap (added imperatively so the source is guaranteed present).
      map.addSource("osm", {
        type: "raster",
        tiles: OSM_TILES,
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      });
      map.addLayer({ id: "osm-tiles", type: "raster", source: "osm" });

      // MOSDAC rainfall overlay (loaded async from metadata)
      fetch("/mosdac/hem_latest.json")
        .then((r) => r.json())
        .then((meta: { file: string; bounds: [number, number, number, number] }) => {
          const [west, south, east, north] = meta.bounds;
          map.addSource("mosdac-rainfall", {
            type: "image",
            url: `/mosdac/${meta.file}`,
            coordinates: [
              [west, north],
              [east, north],
              [east, south],
              [west, south],
            ],
          });
          map.addLayer(
            {
              id: "mosdac-rainfall-layer",
              type: "raster",
              source: "mosdac-rainfall",
              paint: { "raster-opacity": 0.6 },
            },
            "hazard-fill"
          );
        })
        .catch(() => {});

      map.addSource("hazards", { type: "geojson", data: hazardFC([], new Set()) });
      map.addLayer({
        id: "hazard-fill",
        type: "fill",
        source: "hazards",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "breached"], 1],
            "#ff2d55",
            "#f5a623",
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "breached"], 1],
            0.55,
            0.22,
          ],
        },
      });
      map.addLayer({
        id: "hazard-outline",
        type: "line",
        source: "hazards",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "breached"], 1],
            "#ff2d55",
            "#f5a623",
          ],
          "line-width": 2,
        },
      });
      // Route layers (drawn above hazard fills). Direct route is red/dashed,
      // the recommended (safe) route is a thick green line on top.
      map.addSource("route", { type: "geojson", data: routeFC(null) });
      map.addLayer({
        id: "route-direct",
        type: "line",
        source: "route",
        filter: ["==", ["get", "kind"], "direct"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ff2d55",
          "line-width": 3,
          "line-dasharray": [2, 2],
          "line-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "route-recommended",
        type: "line",
        source: "route",
        filter: ["==", ["get", "kind"], "recommended"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#22c55e", "line-width": 5, "line-opacity": 0.95 },
      });

      readyRef.current = true;
      // Push any data that arrived before load.
      (map.getSource("hazards") as maplibregl.GeoJSONSource | undefined)?.setData(
        hazardFC(hazards, breachedHazardIds)
      );
      (map.getSource("route") as maplibregl.GeoJSONSource | undefined)?.setData(
        routeFC(route)
      );
      map.resize();
    });

    // Keep the WebGL map painting. Truck/SOS markers are DOM overlays, so they
    // don't trigger map repaints — which means between interactions the map's
    // render loop goes idle and its canvas can be cleared by the compositor,
    // leaving a blank basemap even though all tiles are loaded. A steady, light
    // repaint (~5/s) keeps the loaded tiles on screen without a busy 60fps loop.
    const keepAlive = window.setInterval(() => map.triggerRepaint(), 200);

    // Keep the map sized to its container for the whole lifetime (handles the
    // initial layout settle, window resizes, and sidebar/panel reflows).
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      window.clearInterval(keepAlive);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update hazard polygons + breach highlighting.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("hazards") as maplibregl.GeoJSONSource | undefined;
    src?.setData(hazardFC(hazards, breachedHazardIds));
  }, [hazards, breachedHazardIds]);

  // Update the route lines and fit bounds when route changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const fc = routeFC(route);
    (map.getSource("route") as maplibregl.GeoJSONSource | undefined)?.setData(fc);
    if (route && route.alternatives.length > 0) {
      const all = route.alternatives.flatMap((a) =>
        a.geometry.coordinates.map((c: number[]) => [c[0], c[1]] as [number, number])
      );
      if (all.length >= 2) {
        const bounds = all.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(all[0], all[0])
        );
        map.fitBounds(bounds, { padding: 60, pitch: 45, duration: 1200 });
      }
    }
  }, [route]);

  // Track registration per vehicle for labels.
  useEffect(() => {
    for (const v of fleet) regByVehicle.current.set(v.id, v.registration);
  }, [fleet]);

  // Sync truck markers to live positions.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [vehicleId, pos] of Object.entries(positions)) {
      const reg = regByVehicle.current.get(vehicleId) ?? vehicleId.slice(0, 6);
      let marker = markersRef.current.get(vehicleId);
      if (!marker) {
        marker = new maplibregl.Marker({
          element: markerEl(reg, pos.headingDeg, pos.speedKmph),
          anchor: "center",
        })
          .setLngLat([pos.longitude, pos.latitude])
          .addTo(map);
        markersRef.current.set(vehicleId, marker);
      } else {
        marker.setLngLat([pos.longitude, pos.latitude]);
        const el = marker.getElement();
        const arrow = el.querySelector<HTMLDivElement>(".truck-arrow");
        if (arrow) arrow.style.transform = `rotate(${pos.headingDeg ?? 0}deg)`;
        const spd = el.querySelector<HTMLDivElement>(".truck-speed");
        if (spd) spd.textContent = pos.speedKmph != null && pos.speedKmph > 0 ? Math.round(pos.speedKmph) + " km/h" : "";
        const moving = pos.speedKmph != null && pos.speedKmph > 1;
        arrow?.classList.toggle("moving", moving);
        const svg = arrow?.querySelector("polygon");
        if (svg) svg.setAttribute("fill", moving ? "#22c55e" : "#64748b");
      }
    }
  }, [positions]);

  // Drop / refresh SOS ping markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const ping of sosPings) {
      seen.add(ping.id);
      if (sosMarkersRef.current.has(ping.id)) continue;
      const el = document.createElement("div");
      el.className = "sos-ping";
      el.innerHTML = `<span class="sos-core">SOS</span>`;
      const m = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([ping.longitude, ping.latitude])
        .addTo(map);
      sosMarkersRef.current.set(ping.id, m);
    }
    // Remove stale pings.
    for (const [id, m] of sosMarkersRef.current) {
      if (!seen.has(id)) {
        m.remove();
        sosMarkersRef.current.delete(id);
      }
    }
  }, [sosPings]);

  // Fly to a focus target (clicking a fleet row or alert).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({
      center: [focus.longitude, focus.latitude],
      zoom: 9.5,
      pitch: 55,
      duration: 1400,
    });
  }, [focus]);

  const [showRainfall, setShowRainfall] = useState(true);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (map.getLayer("mosdac-rainfall-layer")) {
      map.setLayoutProperty("mosdac-rainfall-layer", "visibility", showRainfall ? "visible" : "none");
    }
  }, [showRainfall]);

  return (
    <div className="map-root" ref={containerRef}>
      <div className="mosdac-toggle">
        <button
          className={`toolbtn${showRainfall ? " active" : ""}`}
          onClick={() => setShowRainfall((s) => !s)}
          title="Toggle ISRO MOSDAC rainfall overlay"
        >
          🌧️ {showRainfall ? "Hide" : "Show"} Rainfall
        </button>
      </div>
      {showRainfall && (
        <div className="rainfall-legend">
          <h4>Rainfall (MOSDAC)</h4>
          <div className="legend-row"><div className="legend-swatch" style={{ background: "rgba(170,210,255,0.6)" }} /> &lt;2 mm</div>
          <div className="legend-row"><div className="legend-swatch" style={{ background: "rgba(50,140,255,0.7)" }} /> 2–10 mm</div>
          <div className="legend-row"><div className="legend-swatch" style={{ background: "rgba(255,200,50,0.8)" }} /> 10–35 mm</div>
          <div className="legend-row"><div className="legend-swatch" style={{ background: "rgba(255,40,40,0.85)" }} /> &gt;35 mm</div>
          <div className="legend-source">INSAT-3DR HEM · ISRO</div>
        </div>
      )}
    </div>
  );
}
