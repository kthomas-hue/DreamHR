import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Banner, Button, Field } from "../ui";

const DEMO = [
  { role: "DreamStoneHR consultant (portfolio)", email: "sam@dreamstonehr.com.au" },
  { role: "Client administrator — Northwind Foods", email: "alex@northwindfoods.com.au" },
  { role: "Manager — Northwind Logistics", email: "jordan@northwindfoods.com.au" },
  { role: "Employee — Northwind Foods", email: "taylor@northwindfoods.com.au" },
  { role: "Client administrator — Harbour Point Care", email: "morgan@harbourpointcare.com.au" },
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="brandmark">
          <div className="logo-mark">DH</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>DreamHR</div>
        </div>
        <div>
          <h1>Know what needs attention — and who owns it.</h1>
          <p>
            One secure workspace for people records, policies, credentials, leave and safety —
            connected around the employee, overseen by DreamStoneHR.
          </p>
          <div className="three-q">
            <div><span className="dot" /> What needs attention?</div>
            <div><span className="dot" /> Who is responsible?</div>
            <div><span className="dot" /> What happens next?</div>
          </div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, position: "relative", zIndex: 1 }}>Powered by DreamHR</div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <h2>Sign in</h2>
          <p className="auth-sub">Welcome back. Use a demo account below to explore each role.</p>
          {error && <Banner tone="error">{error}</Banner>}
          <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
            <Field label="Work email" required>
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" required>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="demo-accounts">
            <h4>Demo accounts (password: demo1234)</h4>
            {DEMO.map((d) => (
              <button
                key={d.email}
                className="demo-chip"
                onClick={() => {
                  setEmail(d.email);
                  setPassword("demo1234");
                }}
              >
                <div className="role">{d.role}</div>
                <div className="em">{d.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
