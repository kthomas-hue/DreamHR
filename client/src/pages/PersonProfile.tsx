import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type PersonDetail } from "../api";
import { Avatar, Banner, Card, Pill, Spinner } from "../ui";
import { currencyAud, formatDate, titleCase } from "../utils";

type Tab = "overview" | "documents" | "policies" | "credentials" | "leave";

const VALIDITY_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  current: "success", no_expiry: "success", expiring: "warning", expired: "danger", not_applicable: "neutral", not_yet_valid: "neutral",
};

export function PersonProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState<PersonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!id) return;
    api.person(id).then(setP).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!p) return <Spinner />;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <button className="btn ghost small" onClick={() => nav("/people")}>← People</button>
      </div>

      <Card className="card-pad">
        <div className="profile-head">
          <Avatar name={p.name} size="lg" />
          <div style={{ flex: 1 }}>
            <div className="ph-name">{p.name}</div>
            <div className="muted">{p.employment.title} · {p.employment.team} · {p.employment.site}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Pill tone={p.employment.status === "active" ? "success" : "neutral"}>{titleCase(p.employment.status)}</Pill>
              <Pill tone="brand">{titleCase(p.employment.employmentType)}</Pill>
              {p.employment.probationDate && <Pill tone="warning">Probation to {formatDate(p.employment.probationDate)}</Pill>}
            </div>
          </div>
        </div>
      </Card>

      <div className="tabs" style={{ marginTop: 20 }}>
        {(["overview", "documents", "policies", "credentials", "leave"] as Tab[]).map((t) => (
          <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {titleCase(t)}
          </div>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid cols-2" style={{ alignItems: "start" }}>
          <Card>
            <div className="card-header"><h3>Employment</h3></div>
            <div className="card-pad detail-grid">
              <Detail k="Entity" v={p.employment.entity} />
              <Detail k="Manager" v={p.employment.manager ?? "—"} />
              <Detail k="Start date" v={formatDate(p.employment.startDate)} />
              <Detail k="Ordinary hours" v={`${p.employment.ordinaryHours} / week`} />
              <Detail k="FTE" v={String(p.employment.fte)} />
              <Detail k="Work email" v={p.workEmail} />
              <Detail k="Phone" v={p.phone} />
              <Detail k="Location" v={p.location} />
              <Detail k="Emergency contact" v={p.emergencyContact ?? "Restricted"} />
            </div>
          </Card>
          <Card>
            <div className="card-header"><h3>Remuneration</h3></div>
            <div className="card-pad">
              {p.remuneration ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {currencyAud(p.remuneration.amount, p.remuneration.basis)}
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {p.remuneration.superInclusive ? "Superannuation inclusive" : "Plus superannuation"} · effective {formatDate(p.remuneration.effectiveDate)}
                  </div>
                </>
              ) : (
                <div className="state" style={{ padding: "20px 0" }}>
                  <div className="state-ico">🔒</div>
                  <h4>Restricted</h4>
                  <p style={{ margin: "4px 0 0" }}>Remuneration is not visible to your role.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "documents" && (
        <Card>
          <table className="table">
            <thead><tr><th>Document</th><th>Category</th><th>Version</th><th>Issued</th><th>Released</th></tr></thead>
            <tbody>
              {p.documents.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 20 }}>No documents visible to you.</td></tr>}
              {p.documents.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.title}</td>
                  <td><Pill tone={d.category === "restricted_hr" ? "danger" : d.category === "manager_visible" ? "warning" : "neutral"}>{titleCase(d.category)}</Pill></td>
                  <td>v{d.version}</td>
                  <td className="muted">{formatDate(d.issueDate)}</td>
                  <td>{d.released ? <Pill tone="success">Released</Pill> : <Pill tone="neutral">Internal</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "policies" && (
        <Card>
          <table className="table">
            <thead><tr><th>Policy</th><th>Version</th><th>State</th><th>Due</th></tr></thead>
            <tbody>
              {p.policies.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 20 }}>No policy assignments.</td></tr>}
              {p.policies.map((pol) => (
                <tr key={pol.id}>
                  <td style={{ fontWeight: 600 }}>{pol.title}</td>
                  <td>v{pol.version}</td>
                  <td><Pill tone={pol.state === "acknowledged" ? "success" : "warning"}>{titleCase(pol.state)}</Pill></td>
                  <td className="muted">{formatDate(pol.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "credentials" && (
        <Card>
          <table className="table">
            <thead><tr><th>Credential</th><th>Validity</th><th>Verification</th><th>Expiry</th></tr></thead>
            <tbody>
              {p.credentials.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 20 }}>No required credentials.</td></tr>}
              {p.credentials.map((c, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{c.type}</td>
                  <td><Pill tone={VALIDITY_TONE[c.validity] ?? "neutral"}>{titleCase(c.validity)}</Pill></td>
                  <td><Pill tone={c.verification === "verified" ? "success" : c.verification === "pending" ? "info" : "neutral"}>{titleCase(c.verification)}</Pill></td>
                  <td className="muted">{formatDate(c.expiryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "leave" && (
        <Card>
          <table className="table">
            <thead><tr><th>Type</th><th>Dates</th><th>State</th><th>Reason</th></tr></thead>
            <tbody>
              {p.leave.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 20 }}>No leave records.</td></tr>}
              {p.leave.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{titleCase(l.leaveType)}</td>
                  <td>{formatDate(l.startDate)} → {formatDate(l.endDate)}</td>
                  <td><Pill tone={l.state === "approved" ? "success" : l.state === "declined" ? "danger" : "warning"}>{titleCase(l.state)}</Pill></td>
                  <td className="muted">{l.reason ?? "Private"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="dk">{k}</div>
      <div className="dv">{v}</div>
    </div>
  );
}
