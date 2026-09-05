import { LanguageSwitcher, useLang } from "../i18n";
import { clearToken, getName } from "../auth";

interface Props {
  connected: boolean;
  activeTrucks: number;
  totalTrucks: number;
  hazardCount: number;
  breachCount: number;
  sosCount: number;
  delayedCount: number;
  onMenuToggle?: () => void;
}

export default function StatBar({
  connected,
  activeTrucks,
  totalTrucks,
  hazardCount,
  breachCount,
  sosCount,
  delayedCount,
  onMenuToggle,
}: Props) {
  const { t } = useLang();
  const userName = getName();

  const handleLogout = () => {
    clearToken();
    window.location.reload();
  };

  return (
    <header className="topbar">
      <button
        className="menu-btn"
        onClick={onMenuToggle}
        aria-label="Toggle fleet panel"
      >
        ☰
      </button>

      {/* Left: MDoNER logo */}
      <div className="brand">
        <img src="/mdoner-logo.png" alt="Ministry of Development of North Eastern Region" className="topbar-mdoner" />
      </div>

      <div className="stats">
        <Stat label={t("active")} value={`${activeTrucks}/${totalTrucks}`} tone="ok" />
        <Stat label={t("hazards")} value={hazardCount} tone="warn" />
        <Stat label={t("breaches")} value={breachCount} tone={breachCount ? "warn" : "muted"} />
        <Stat label={t("delayed")} value={delayedCount} tone={delayedCount ? "warn" : "muted"} />
        <Stat label={t("sos")} value={sosCount} tone={sosCount ? "danger" : "muted"} />
      </div>

      <LanguageSwitcher />

      <div className={`conn ${connected ? "up" : "down"}`}>
        <span className="conn-dot" />
        {connected ? t("live") : t("reconnecting")}
      </div>

      {/* Right: SIH logo */}
      <img src="/sih-logo.png" alt="Smart India Hackathon 2026" className="topbar-sih" />

      <div className="user-menu">
        {userName && <span className="user-name">{userName}</span>}
        <button className="logout-btn" onClick={handleLogout} title="Sign out">
          Logout
        </button>
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
