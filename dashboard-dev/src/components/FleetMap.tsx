import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Marker, StyleSpecification } from "maplibre-gl";
import type {
  FleetVehicle,
  FleetPosition,
  HazardFeature,
  RouteResult,
} from "../types";
import type { OperatingMode } from "../places";

interface Props {
  mode: OperatingMode;
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
    features: hazards.map((h, idx) => {
      const isNepal = "country" in h && (h as Record<string, unknown>).country === "NP";
      const kind = h.kind ?? "flood";
      return {
        type: "Feature" as const,
        id: idx,
        properties: {
          id: h.id,
          label: h.label,
          severity: h.severity,
          risk: h.risk_score,
          breached: breached.has(h.id) ? 1 : 0,
          kind,
          isNepal: isNepal ? 1 : 0,
          isDemo: isNepal && (h as Record<string, unknown>).is_demo ? 1 : 0,
        },
        geometry: h.geometry,
      };
    }),
  };
}

/** Build a complete map style with hazard + route data baked into sources.
 *  MapLibre's tile worker reliably processes GeoJSON sources defined in the
 *  style spec, but can fail to generate tiles for sources added via addSource. */
function buildStyle(
  hazardData: GeoJSON.FeatureCollection,
  routeData: GeoJSON.FeatureCollection
): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://cdn.jsdelivr.net/npm/@maptiler/fonts@1/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "raster",
        tiles: OSM_TILES,
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
      hazards: { type: "geojson", data: hazardData },
      route: { type: "geojson", data: routeData },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#e8eef6" } },
      { id: "osm-tiles", type: "raster", source: "osm" },
      {
        id: "hazard-fill", type: "fill", source: "hazards",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "breached"], 1], "#ff2d55",
            ["==", ["get", "kind"], "flood"], "#2196f3",
            ["==", ["get", "kind"], "landslide"], "#8b4513",
            ["==", ["get", "kind"], "road_closure"], "#ff5722",
            ["==", ["get", "kind"], "roadblock"], "#ff5722",
            "#f5a623",
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "breached"], 1], 0.55,
            [">=", ["get", "severity"], 4], 0.45,
            [">=", ["get", "severity"], 3], 0.32,
            0.22,
          ],
        },
      },
      {
        id: "hazard-outline", type: "line", source: "hazards",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "breached"], 1], "#ff2d55",
            ["==", ["get", "kind"], "flood"], "#1565c0",
            ["==", ["get", "kind"], "landslide"], "#5d4037",
            ["==", ["get", "kind"], "road_closure"], "#d84315",
            ["==", ["get", "kind"], "roadblock"], "#d84315",
            "#f5a623",
          ],
          "line-width": 2.5,
        },
      },
      {
        id: "hazard-labels", type: "symbol", source: "hazards",
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Regular"],
          "text-size": 11,
          "text-anchor": "center",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#1a1a2e",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      },
      {
        id: "route-direct", type: "line", source: "route",
        filter: ["==", ["get", "kind"], "direct"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ff2d55", "line-width": 3, "line-dasharray": [2, 2], "line-opacity": 0.85 },
      },
      {
        id: "route-recommended", type: "line", source: "route",
        filter: ["==", ["get", "kind"], "recommended"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#22c55e", "line-width": 5, "line-opacity": 0.95 },
      },
    ],
  } as StyleSpecification;
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
  mode,
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
  const onClickRef = useRef<Props["onMapClick"]>(onMapClick);
  onClickRef.current = onMapClick;
  const hazardsRef = useRef(hazards);
  hazardsRef.current = hazards;
  const breachedRef = useRef(breachedHazardIds);
  breachedRef.current = breachedHazardIds;
  const routeRef = useRef(route);
  routeRef.current = route;
  const styleSwapping = useRef(false);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current) return;

    const initStyle = buildStyle(
      hazardFC(hazardsRef.current, breachedRef.current),
      routeFC(routeRef.current)
    );

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initStyle,
      center: [92.5, 26.5],
      zoom: 7,
      pitch: 55,
      bearing: -18,
      attributionControl: { compact: true },
      preserveDrawingBuffer: true,
    });
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

    map.once("load", () => {
      readyRef.current = true;

      // MOSDAC rainfall overlay (async, added imperatively after load)
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
          map.addLayer({
            id: "mosdac-rainfall-layer",
            type: "raster",
            source: "mosdac-rainfall",
            paint: { "raster-opacity": 0.6 },
          }, "hazard-fill");
        })
        .catch(() => {});

      map.resize();
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to the correct region and clear markers when mode changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [, m] of markersRef.current) m.remove();
    markersRef.current.clear();
    for (const [, m] of sosMarkersRef.current) m.remove();
    sosMarkersRef.current.clear();
    if (mode === "nepal") {
      map.flyTo({ center: [84.5, 27.7], zoom: 7, pitch: 45, bearing: 0, duration: 1800 });
    } else {
      map.flyTo({ center: [92.5, 26.5], zoom: 7, pitch: 55, bearing: -18, duration: 1800 });
    }
  }, [mode]);

  // Update hazard polygons via setStyle (bakes new data into the style spec,
  // which reliably triggers the GeoJSON tile worker).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const fc = hazardFC(hazards, breachedHazardIds);
    const routeData = routeFC(routeRef.current);
    const style = buildStyle(fc, routeData);
    // Pause marker updates so the tile worker gets CPU time to process polygons.
    styleSwapping.current = true;
    map.stop();
    map.setStyle(style, { diff: false });
    const t = window.setTimeout(() => { styleSwapping.current = false; }, 3000);
    return () => { window.clearTimeout(t); styleSwapping.current = false; };
  }, [hazards, breachedHazardIds]);

  // Update the route lines and fit bounds when route changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const fc = routeFC(route);
    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(fc);
    } else {
      // If source doesn't exist yet (style was just swapped), rebuild via setStyle
      const hazardData = hazardFC(hazardsRef.current, breachedRef.current);
      map.setStyle(buildStyle(hazardData, fc), { diff: false });
    }
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
    if (!map || styleSwapping.current) return;
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
      {mode === "nepal" && (
        <div className="hazard-legend">
          <h4>Hazard Legend</h4>
          <div className="legend-row"><div className="legend-swatch flood" /> Flood Zone</div>
          <div className="legend-row"><div className="legend-swatch landslide" /> Landslide</div>
          <div className="legend-row"><div className="legend-swatch road-closure" /> Road Closure</div>
          <div className="legend-row"><div className="legend-swatch sos-marker" /> SOS / Emergency</div>
        </div>
      )}
    </div>
  );
}
