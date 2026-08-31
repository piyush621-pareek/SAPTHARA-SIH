import { useState } from "react";
import { getToken, login } from "../auth";

/**
 * Wraps the dashboard: shows a login screen until the operator signs in (or
 * chooses guest/read-only). A stored token keeps the session across reloads.
 */
export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(() => getToken() != null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authed) return <>{children}</>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <div className="brand-mark">NER</div>
          <div>
            <div className="login-title">Command &amp; Control</div>
            <div className="login-sub">Authority sign-in</div>
          </div>
        </div>
        <input
          className="login-input"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="username"
        />
        <input
          className="login-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
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
  );
}
