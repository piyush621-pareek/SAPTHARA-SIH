import { useState } from "react";
import { NER_PLACES, placeName } from "../places";
import { postReport, type NewReport } from "../api";
import { useLang } from "../i18n";

interface Props {
  /** If the operator clicked the map first, prefill that location. */
  pickedPoint: { lat: number; lng: number } | null;
  onSubmitted: () => void;
  onClose: () => void;
}

const TYPES: NewReport["report_type"][] = [
  "landslide",
  "flood",
  "roadblock",
  "supply_issue",
  "other",
];
const TYPE_LABEL: Record<NewReport["report_type"], string> = {
  landslide: "🏔 Landslide",
  flood: "🌊 Flood",
  roadblock: "🚧 Roadblock",
  supply_issue: "📦 Supply issue",
  other: "❓ Other",
};
const URGENCY: NewReport["urgency"][] = ["low", "medium", "high", "critical"];

/**
 * File a field report — the phone app's "Report a hazard" flow inside the
 * dashboard. Location comes from a clicked map point (if any) or a place picker.
 */
export default function ReportForm({ pickedPoint, onSubmitted, onClose }: Props) {
  const { t } = useLang();
  const [type, setType] = useState<NewReport["report_type"]>("landslide");
  const [urgency, setUrgency] = useState<NewReport["urgency"]>("high");
  const [notes, setNotes] = useState("");
  const [placeIdx, setPlaceIdx] = useState(
    NER_PLACES.findIndex((p) => p.name === "Dirang")
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usingMapPoint = pickedPoint != null;
  const loc = usingMapPoint
    ? { lat: pickedPoint!.lat, lng: pickedPoint!.lng }
    : { lat: NER_PLACES[placeIdx].lat, lng: NER_PLACES[placeIdx].lng };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await postReport({
        report_type: type,
        urgency,
        notes,
        latitude: loc.lat,
        longitude: loc.lng,
      });
      onSubmitted();
    } catch {
      setError("Could not send the report just now.");
      setBusy(false);
    }
  };

  return (
    <div className="map-card">
      <button className="card-close" onClick={onClose} aria-label="close">
        ✕
      </button>
      <h3>📝 {t("reportHazard")}</h3>
      <div className="sub">
        📍 {placeName(loc.lat, loc.lng)}
        {usingMapPoint ? " (from map)" : ""}
      </div>

      <label className="field-label">{t("hazardType")}</label>
      <select
        className="field"
        value={type}
        onChange={(e) => setType(e.target.value as NewReport["report_type"])}
      >
        {TYPES.map((tp) => (
          <option key={tp} value={tp}>
            {TYPE_LABEL[tp]}
          </option>
        ))}
      </select>

      {!usingMapPoint && (
        <>
          <label className="field-label">{t("from")}</label>
          <select
            className="field"
            value={placeIdx}
            onChange={(e) => setPlaceIdx(Number(e.target.value))}
          >
            {NER_PLACES.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </>
      )}

      <label className="field-label">{t("urgency")}</label>
      <select
        className="field"
        value={urgency}
        onChange={(e) => setUrgency(e.target.value as NewReport["urgency"])}
      >
        {URGENCY.map((u) => (
          <option key={u} value={u}>
            {u[0].toUpperCase() + u.slice(1)}
          </option>
        ))}
      </select>

      <label className="field-label">{t("notes")}</label>
      <textarea
        className="field"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g. Boulders on the road near the bend…"
      />

      {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}

      <div className="card-actions">
        <button className="toolbtn" onClick={onClose}>
          {t("cancel")}
        </button>
        <button className="toolbtn primary" onClick={submit} disabled={busy}>
          {busy ? "…" : t("submit")}
        </button>
      </div>
    </div>
  );
}
