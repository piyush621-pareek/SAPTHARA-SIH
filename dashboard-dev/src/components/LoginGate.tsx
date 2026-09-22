import { useState } from "react";
import { getToken, login } from "../auth";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(() => getToken() != null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authed) return <>{children}</>;

  const phoneValid = /^\d{10,}$/.test(phone.trim());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValid) { setError("Enter a valid 10-digit phone number"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setBusy(true);
    setError(null);
    try {
      await login(phone.trim(), password);
      setAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      {/* Government-style wide header banner */}
      <div className="gov-banner">
        <div className="gov-banner-inner">
          <img src="/emblem-india.jpg" alt="State Emblem of India" className="gov-emblem" />
          <div className="gov-banner-text">
            <div className="gov-ministry">Ministry of Development of North Eastern Region</div>
            <div className="gov-ministry-hi">उत्तर पूर्वी क्षेत्र विकास मंत्रालय</div>
            <div className="gov-govt">Government of India | भारत सरकार</div>
          </div>
        </div>
      </div>

      {/* Main login area */}
      <div className="login-body">
        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-logos">
            <img src="/sapthara-logo.png" alt="SAPTHARA" className="login-sapthara-logo" />
            <img src="/sih-logo.png" alt="Smart India Hackathon 2026" className="login-sih-logo" />
          </div>
          <div className="login-brand">
            <div>
              <div className="login-sub">Smart AI Platform for Transportation &amp; Hazard-Aware Routing Analytics</div>
            </div>
          </div>
          <div className="login-divider" />
          <div className="login-field-wrap">
            <input
              className="login-input"
              placeholder="Phone number (10 digits)"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
              autoComplete="username"
              inputMode="tel"
            />
          </div>
          <div className="login-field-wrap pwd-wrap">
            <input
              className="login-input"
              type={showPwd ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="pwd-toggle"
              onClick={() => setShowPwd((s) => !s)}
              tabIndex={-1}
            >
              {showPwd ? "Hide" : "Show"}
            </button>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="login-btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "SIGN IN"}
          </button>
          <button
            type="button"
            className="login-guest"
            onClick={() => setAuthed(true)}
          >
            Continue as guest (read-only)
          </button>
        </form>
      </div>

      {/* Bottom government footer */}
      <div className="gov-footer">
        <span>© 2026 MDoNER, Government of India</span>
        <span>·</span>
        <span>Designed &amp; Developed under Smart India Hackathon 2026</span>
      </div>
    </div>
  );
}
