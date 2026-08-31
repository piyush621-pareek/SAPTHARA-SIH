import type { ConnectivityData, DistrictStatus } from "../types";

interface Props {
  data: ConnectivityData | null;
  onFocus?: (lng: number, lat: number) => void;
}

const STATUS_LABEL: Record<DistrictStatus["status"], string> = {
  open: "Open",
  at_risk: "At risk",
  blocked: "Blocked",
};

/**
 * District-wise connectivity status + delayed-delivery summary (PS 26002 g/e).
 * Blocked/at-risk districts are surfaced first; open districts are summarised.
 */
export default function ConnectivityPanel({ data, onFocus }: Props) {
  if (!data) {
    return (
      <section className="panel connectivity">
        <div className="panel-head">District Connectivity</div>
        <div className="panel-empty">Loading connectivity…</div>
      </section>
    );
  }

  const affected = data.districts
    .filter((d) => d.status !== "open")
    .sort((a) => (a.status === "blocked" ? -1 : 1));
  const delayed = data.deliveries.filter((d) => d.status !== "on_time");

  return (
    <section className="panel connectivity">
      <div className="panel-head">
        District Connectivity
        <span className="conn-pills">
          <span className="cpill ok">{data.district_summary.open} open</span>
          <span className="cpill warn">{data.district_summary.at_risk} at-risk</span>
          <span className="cpill danger">{data.district_summary.blocked} blocked</span>
        </span>
      </div>

      <div className="conn-list">
        {affected.length === 0 && (
          <div className="panel-empty">All districts open — corridors nominal.</div>
        )}
        {affected.map((d) => (
          <div key={d.node_id} className={`conn-row ${d.status}`} title={d.hazards.join(", ")}>
            <span className={`conn-dot2 ${d.status}`} />
            <span className="conn-city">
              {d.city}
              <span className="conn-district">
                {d.district}, {d.state}
              </span>
            </span>
            <span className="conn-meta">
              <span className={`conn-badge ${d.status}`}>{STATUS_LABEL[d.status]}</span>
              <span className="conn-routes">
                {d.routes_blocked}/{d.routes_total} routes hit
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="panel-head sub">
        Deliveries
        <span className="conn-pills">
          <span className="cpill ok">{data.summary.on_time} on-time</span>
          <span className="cpill warn">{data.summary.at_risk} at-risk</span>
          <span className="cpill danger">{data.summary.delayed} delayed</span>
        </span>
      </div>
      <div className="conn-list">
        {delayed.length === 0 && (
          <div className="panel-empty">All deliveries on schedule.</div>
        )}
        {delayed.map((v) => (
          <button
            key={v.vehicle_id}
            className={`conn-row ${v.status === "delayed" ? "blocked" : "at_risk"}`}
            onClick={() =>
              v.latitude != null && v.longitude != null
                ? onFocus?.(v.longitude, v.latitude)
                : undefined
            }
          >
            <span className={`conn-dot2 ${v.status === "delayed" ? "blocked" : "at_risk"}`} />
            <span className="conn-city">
              {v.registration}
              <span className="conn-district">{v.reason}</span>
            </span>
            <span className="conn-meta">
              <span className={`conn-badge ${v.status === "delayed" ? "blocked" : "at_risk"}`}>
                {v.status === "delayed" ? "Delayed" : "At risk"}
              </span>
              {v.estimated_delay_min > 0 && (
                <span className="conn-routes">+{v.estimated_delay_min} min</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
