import type { OperatingMode } from "../places";

interface Props {
  mode: OperatingMode;
  onChange: (mode: OperatingMode) => void;
}

export default function ModeSwitcher({ mode, onChange }: Props) {
  return (
    <div className="mode-switcher">
      <button
        className={`mode-btn ${mode === "india" ? "active" : ""}`}
        onClick={() => onChange("india")}
      >
        🇮🇳 North-East India
      </button>
      <button
        className={`mode-btn ${mode === "nepal" ? "active" : ""}`}
        onClick={() => onChange("nepal")}
      >
        🇳🇵 Nepal Flood Response
      </button>
    </div>
  );
}
