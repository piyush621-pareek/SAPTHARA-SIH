import type { GeoRisk } from "../types";
import { placeName } from "../places";

interface Props {
  risk: GeoRisk | null;
  loading: boolean;
  point: { lat: number; lng: number } | null;
  onClose: () => void;
}

function riskColor(v: number): string {
  if (v >= 0.8) return "#ff2d55";
  if (v >= 0.6) return "#ff6b35";
  if (v >= 0.35) return "#f5a623";
  return "#22c55e";
}

function SourceTag({ label, source }: { label: string; source: string }) {
  const live = source === "mosdac" || source === "cartodem" || source === "bhuvan_wms";
  return (
    <span className={`src-tag ${live ? "live" : "modelled"}`}>
      {label}: {live ? "LIVE" : "modelled"}
    </span>
  );
}

export default function SatelliteRiskCard({ risk, loading, point, onClose }: Props) {
  if (!point) return null;

  return (
    <div className="sat-card">
      <div className="sat-head">
        <div>
          <div className="sat-title">🛰 Multi-Hazard Risk</div>
          <div className="sat-coord">
            📍 {placeName(point.lat, point.lng)}
          </div>
        </div>
        <button className="sat-close" onClick={onClose} aria-label="close">
          ✕
        </button>
      </div>

      {loading && <div className="sat-loading">Querying ISRO feeds…</div>}

      {!loading && risk && (
        <>
          <div className="sat-riskrow">
            <div
              className="sat-score"
              style={{ borderColor: riskColor(risk.fused_risk), color: riskColor(risk.fused_risk) }}
            >
              {Math.round(risk.fused_risk * 100)}
              <span>%</span>
            </div>
            <div className="sat-action">
              <div
                className="sat-action-badge"
                style={{ background: riskColor(risk.fused_risk) }}
              >
                {risk.recommended_action}
              </div>
              <div className="sat-action-sub">
                fused risk · AI {Math.round(risk.ai.risk_score * 100)}%
              </div>
            </div>
          </div>

          <div className="sat-hazards">
            <HazardChip label="Landslide" v={risk.fused_risk} action={risk.recommended_action} />
            <HazardChip label="Flood" v={risk.flood.risk_score} action={risk.flood.recommended_action} />
            <HazardChip
              label="Congestion"
              v={risk.congestion.risk_score}
              action={risk.congestion.recommended_action}
            />
          </div>

          <div className="sat-grid">
            <Metric label="Rainfall (24h)" value={`${risk.context.rainfall_mm} mm`} />
            <Metric label="Soil moisture" value={`${Math.round(risk.context.soil_moisture * 100)}%`} />
            <Metric label="Slope" value={`${risk.context.slope_deg}°`} />
            <Metric label="Elevation" value={`${risk.context.elevation_m} m`} />
            <Metric label="Susceptibility" value={risk.context.landslide_susceptibility} />
            <Metric label="AI engine" value={risk.ai.source === "ai_service" ? "FastAPI" : "fallback"} />
          </div>

          <div className="sat-sources">
            <SourceTag label="MOSDAC" source={risk.context.sources.rainfall} />
            <SourceTag label="CartoDEM" source={risk.context.sources.terrain} />
            <SourceTag label="Bhuvan" source={risk.context.sources.susceptibility} />
          </div>
        </>
      )}
    </div>
  );
}

function HazardChip({ label, v, action }: { label: string; v: number; action: string }) {
  return (
    <div className="hz-chip" style={{ borderColor: riskColor(v) }}>
      <div className="hz-top">
        <span className="hz-label">{label}</span>
        <span className="hz-pct" style={{ color: riskColor(v) }}>
          {Math.round(v * 100)}%
        </span>
      </div>
      <div className="hz-action" style={{ color: riskColor(v) }}>
        {action}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="sat-metric">
      <div className="sat-metric-val">{value}</div>
      <div className="sat-metric-label">{label}</div>
    </div>
  );
}
