import { useState } from "react";
import { NER_PLACES } from "../places";
import { fetchRoute } from "../api";
import type { RouteResult } from "../types";
import { useLang } from "../i18n";

interface Props {
  onRoute: (route: RouteResult, focus: { lat: number; lng: number }) => void;
  onClose: () => void;
}

/**
 * From → To trip planner — the phone app's route feature, brought into the
 * control room. Pick two NER towns; the backend returns a hazard-aware route
 * that the map draws (green recommended vs red direct).
 */
export default function RoutePlanner({ onRoute, onClose }: Props) {
  const { t } = useLang();
  const [fromIdx, setFromIdx] = useState(
    NER_PLACES.findIndex((p) => p.name === "Guwahati")
  );
  const [toIdx, setToIdx] = useState(
    NER_PLACES.findIndex((p) => p.name === "Tawang")
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    const from = NER_PLACES[fromIdx];
    const to = NER_PLACES[toIdx];
    if (!from || !to || fromIdx === toIdx) {
      setError("Pick two different places.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const route = await fetchRoute(
        { latitude: from.lat, longitude: from.lng },
        { latitude: to.lat, longitude: to.lng }
      );
      setResult(route);
      onRoute(route, { lat: from.lat, lng: from.lng });
    } catch {
      setError("Could not plan that route just now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="map-card">
      <button className="card-close" onClick={onClose} aria-label="close">
        ✕
      </button>
      <h3>🧭 {t("planRoute")}</h3>
      <div className="sub">Choose where the convoy starts and ends.</div>

      <label className="field-label">{t("from")}</label>
      <select
        className="field"
        value={fromIdx}
        onChange={(e) => setFromIdx(Number(e.target.value))}
      >
        {NER_PLACES.map((p, i) => (
          <option key={p.name} value={i}>
            {p.name}
          </option>
        ))}
      </select>

      <label className="field-label">{t("to")}</label>
      <select
        className="field"
        value={toIdx}
        onChange={(e) => setToIdx(Number(e.target.value))}
      >
        {NER_PLACES.map((p, i) => (
          <option key={p.name} value={i}>
            {p.name}
          </option>
        ))}
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
        </div>
      )}
    </div>
  );
}
