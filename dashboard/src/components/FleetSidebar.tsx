import type { FleetVehicle, FleetPosition } from "../types";
import { placeName } from "../places";

interface Props {
  fleet: FleetVehicle[];
  positions: Record<string, FleetPosition>;
  statusByReg?: Record<string, "sos" | "breach" | "delayed">;
  onFocus: (lng: number, lat: number) => void;
}

const STATUS_LABEL: Record<"sos" | "breach" | "delayed", string> = {
  sos: "SOS",
  breach: "In hazard",
  delayed: "Delayed",
};

export default function FleetSidebar({
  fleet,
  positions,
  statusByReg = {},
  onFocus,
}: Props) {
  return (
    <div className="panel fleet-panel">
      <div className="panel-title">
        <span>FLEET</span>
        <span className="pill">{fleet.length}</span>
      </div>
      <div className="fleet-list">
        {fleet.map((v) => {
          const p = positions[v.id];
          const lat = p?.latitude ?? v.latitude;
          const lng = p?.longitude ?? v.longitude;
          const moving = p?.speedKmph != null && p.speedKmph > 1;
          const st = statusByReg[v.registration];
          return (
            <button
              key={v.id}
              className={`fleet-row ${st ? `st-${st}` : ""}`}
              disabled={lat == null || lng == null}
              onClick={() => lat != null && lng != null && onFocus(lng, lat)}
            >
              <span className={`dot ${moving ? "live" : "idle"}`} />
              <div className="fleet-meta">
                <div className="fleet-reg">
                  {v.registration}
                  {st && <span className={`fleet-status ${st}`}>{STATUS_LABEL[st]}</span>}
                </div>
                <div className="fleet-sub">
                  {lat != null && lng != null ? placeName(lat, lng) : "no fix yet"}
                </div>
              </div>
              <div className="fleet-speed">
                {p?.speedKmph != null ? `${Math.round(p.speedKmph)}` : "—"}
                <span className="unit">km/h</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
