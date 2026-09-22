import { useState, useEffect } from "react";
import { placesForMode, type OperatingMode } from "../places";
import { fetchRoute, nepalMockRoute } from "../api";
import type { RouteResult, HazardFeature } from "../types";
import { useLang } from "../i18n";

interface Props {
  mode: OperatingMode;
  nepalHazards?: HazardFeature[];
  onRoute: (route: RouteResult, focus: { lat: number; lng: number }) => void;
  onClose: () => void;
}

export default function RoutePlanner({ mode, nepalHazards, onRoute, onClose }: Props) {
  const { t } = useLang();
  const places = placesForMode(mode);
  const defaultFrom = mode === "nepal"
    ? places.findIndex((p) => p.name === "Kathmandu")
    : places.findIndex((p) => p.name === "Guwahati");
  const defaultTo = mode === "nepal"
    ? places.findIndex((p) => p.name === "Pokhara")
    : places.findIndex((p) => p.name === "Tawang");
  const [fromIdx, setFromIdx] = useState(defaultFrom >= 0 ? defaultFrom : 0);
  const [toIdx, setToIdx] = useState(defaultTo >= 0 ? defaultTo : 1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset selections when mode changes
  useEffect(() => {
    setFromIdx(defaultFrom >= 0 ? defaultFrom : 0);
    setToIdx(defaultTo >= 0 ? defaultTo : 1);
    setResult(null);
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const find = async () => {
    const from = places[fromIdx];
    const to = places[toIdx];
    if (!from || !to || fromIdx === toIdx) {
      setError("Pick two different places.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let route: RouteResult;
      if (mode === "nepal") {
        const polygons = (nepalHazards ?? []).map((h) => h.geometry);
        route = await nepalMockRoute(
          { latitude: from.lat, longitude: from.lng },
          { latitude: to.lat, longitude: to.lng },
          polygons
        );
      } else {
        route = await fetchRoute(
          { latitude: from.lat, longitude: from.lng },
          { latitude: to.lat, longitude: to.lng }
        );
      }
      setResult(route);
      onRoute(route, { lat: from.lat, lng: from.lng });
    } catch {
      setError("Could not plan that route just now.");
    } finally {
      setBusy(false);
    }
  };

  const detourExplanation = result?.hazard_avoided && result.avoided_hazards.length > 0
    ? `Recommended detour avoids ${result.avoided_hazards.join(", ")}.`
    : null;

  return (
    <div className="map-card">
      <button className="card-close" onClick={onClose} aria-label="close">✕</button>
      <h3>🧭 {t("planRoute")}</h3>
      <div className="sub">
        {mode === "nepal"
          ? "Plan a Nepal flood-response convoy route."
          : "Choose where the convoy starts and ends."}
      </div>

      <label className="field-label">{t("from")}</label>
      <select className="field" value={fromIdx} onChange={(e) => setFromIdx(Number(e.target.value))}>
        {places.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
      </select>

      <label className="field-label">{t("to")}</label>
      <select className="field" value={toIdx} onChange={(e) => setToIdx(Number(e.target.value))}>
        {places.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
      </select>

      {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}

      <div className="card-actions">
        <button className="toolbtn primary" onClick={find} disabled={busy}>
          {busy ? "…" : t("findRoute")}
        </button>
      </div>

      {result && (
        <div className={`route-outcome ${result.hazard_avoided ? "rerouted" : "clear"}`}>
          {result.hazard_avoided
            ? `⚠ ${t("rerouted")} · ${result.distance_km} km`
            : `✓ ${t("clearRoute")} · ${result.distance_km} km`}
          {detourExplanation && (
            <div className="detour-explain">{detourExplanation}</div>
          )}
        </div>
      )}
    </div>
  );
}
