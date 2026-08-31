import type { FeedItem } from "../types";

interface Props {
  feed: FeedItem[];
  onFocus: (lng: number, lat: number) => void;
}

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}

export default function AlertsFeed({ feed, onFocus }: Props) {
  return (
    <div className="panel alerts-panel">
      <div className="panel-title">
        <span>LIVE ALERTS</span>
        <span className="pill danger">{feed.length}</span>
      </div>
      <div className="alerts-list">
        {feed.length === 0 && (
          <div className="alerts-empty">No active alerts. Corridor nominal.</div>
        )}
        {feed.map((f) => (
          <button
            key={f.id}
            className={`alert-card ${f.kind}`}
            onClick={() => onFocus(f.location.longitude, f.location.latitude)}
          >
            <div className="alert-head">
              <span className="alert-badge">
                {f.kind === "sos"
                  ? "🆘 SOS"
                  : f.kind === "delivery"
                    ? "⏱ DELAYED"
                    : "⚠ GEOFENCE"}
              </span>
              <span className="alert-time">{ago(f.at)}</span>
            </div>
            <div className="alert-title">{f.title}</div>
            <div className="alert-detail">{f.detail}</div>
            <div className="alert-foot">
              {f.vehicle} · {f.location.latitude.toFixed(3)},
              {f.location.longitude.toFixed(3)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
