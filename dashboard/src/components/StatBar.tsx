interface Props {
  connected: boolean;
  activeTrucks: number;
  totalTrucks: number;
  hazardCount: number;
  breachCount: number;
  sosCount: number;
  delayedCount: number;
}

export default function StatBar({
  connected,
  activeTrucks,
  totalTrucks,
  hazardCount,
  breachCount,
  sosCount,
  delayedCount,
}: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">NER</div>
        <div className="brand-text">
          <div className="brand-title">Command &amp; Control</div>
          <div className="brand-sub">Smart Logistics · North Eastern Region</div>
        </div>
      </div>

      <div className="stats">
        <Stat label="Active" value={`${activeTrucks}/${totalTrucks}`} tone="ok" />
        <Stat label="Hazards" value={hazardCount} tone="warn" />
        <Stat label="Breaches" value={breachCount} tone={breachCount ? "warn" : "muted"} />
        <Stat label="Delayed" value={delayedCount} tone={delayedCount ? "warn" : "muted"} />
        <Stat label="SOS" value={sosCount} tone={sosCount ? "danger" : "muted"} />
      </div>

      <div className={`conn ${connected ? "up" : "down"}`}>
        <span className="conn-dot" />
        {connected ? "SOCKET LIVE" : "RECONNECTING…"}
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "ok" | "warn" | "danger" | "muted";
}) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
