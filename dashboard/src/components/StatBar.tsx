import { LanguageSwitcher, useLang } from "../i18n";

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
  return (
    <header className="topbar">
      <button
        className="menu-btn"
        onClick={onMenuToggle}
        aria-label="Toggle fleet panel"
      >
        ☰
      </button>
      <div className="brand">
        <div className="brand-mark">NER</div>
        <div className="brand-text">
          <div className="brand-title">{t("brandTitle")}</div>
          <div className="brand-sub">{t("brandSub")}</div>
        </div>
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
