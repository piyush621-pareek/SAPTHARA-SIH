import type { LedgerEntry, LedgerVerify } from "../types";

interface Props {
  entries: LedgerEntry[];
  verify: LedgerVerify | null;
}

const ICONS: Record<string, string> = {
  "emergency.sos": "🆘",
  "trip.status": "🚚",
  "hazard.created": "⚠",
};

export default function LedgerPanel({ entries, verify }: Props) {
  return (
    <div className="panel ledger-panel">
      <div className="panel-title">
        <span>AUDIT LEDGER</span>
        {verify && (
          <span className={`chain-badge ${verify.valid ? "ok" : "broken"}`}>
            {verify.valid ? `🔗 VERIFIED · ${verify.length}` : `⛓ BROKEN @${verify.brokenAtSeq}`}
          </span>
        )}
      </div>
      <div className="ledger-list">
        {entries.length === 0 && (
          <div className="ledger-empty">No records yet. Hash chain starts on first event.</div>
        )}
        {entries.map((e) => (
          <div key={e.seq} className="ledger-row">
            <div className="ledger-seq">#{e.seq}</div>
            <div className="ledger-body">
              <div className="ledger-type">
                {ICONS[e.event_type] ?? "•"} {e.event_type}
              </div>
              <div className="ledger-hash" title={e.hash}>
                hash {e.hash.slice(0, 10)}… ← prev {e.prev_hash.slice(0, 8)}…
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
