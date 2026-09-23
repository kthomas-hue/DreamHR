import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type PortfolioPayload } from "../api";
import { useAuth } from "../auth/AuthContext";
import { ActionStream } from "../components/ActionStream";
import type { HomePayload } from "../types";
import { Banner, Card, Pill, Spinner } from "../ui";
import { formatDate } from "../utils";

export function Home() {
  const { me } = useAuth();
  if (me?.user.isDreamStone && !me.activeClient) return <Portfolio />;
  return <ClientHome />;
}

// ---------------------------------------------------------------------------
// DreamStoneHR portfolio — cross-client operating queue (ADM-01)
// ---------------------------------------------------------------------------
function Portfolio() {
  const nav = useNavigate();
  const { switchClient, me } = useAuth();
  const [data, setData] = useState<PortfolioPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.portfolio().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Spinner />;

  async function enter(clientId: string) {
    await switchClient(clientId);
    nav("/");
  }

  return (
    <>
      <div className="attention">
        <div className="att-eyebrow">DreamStoneHR · Portfolio</div>
        <h2>
          {data.totals.urgent > 0
            ? `${data.totals.urgent} urgent item${data.totals.urgent === 1 ? "" : "s"} across ${data.totals.clients} assigned client${data.totals.clients === 1 ? "" : "s"} need attention.`
            : `Your ${data.totals.clients} assigned clients are on track.`}
        </h2>
        <div className="att-meta">
          <div><div className="m-v">{data.totals.urgent}</div><div className="m-k">Urgent</div></div>
          <div><div className="m-v">{data.totals.high}</div><div className="m-k">Due soon</div></div>
          <div><div className="m-v">{data.totals.clients}</div><div className="m-k">Clients</div></div>
        </div>
      </div>

      <div className="grid cols-2">
        {data.clients.map((c) => (
          <div key={c.id} className="pf-client">
            <div className="pf-top">
              <span className="cs-badge" style={{ width: 34, height: 34, borderRadius: 9 }}>{c.logoText}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{c.displayName}</div>
                <div className="muted small">{c.legalName} · {c.timezone.split("/")[1]}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Pill tone={c.status === "active" ? "success" : "info"}>{c.status}</Pill>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, padding: "10px 16px" }}>
              <Pill tone="danger">{c.counts.urgent} urgent</Pill>
              <Pill tone="warning">{c.counts.high} soon</Pill>
              <Pill tone="neutral">{c.counts.people} people</Pill>
            </div>
            <div className="pf-actions">
              {c.topActions.length === 0 && <div className="muted small" style={{ padding: "6px 10px" }}>No outstanding actions.</div>}
              {c.topActions.map((a) => (
                <div key={a.id} className="pf-mini" onClick={() => enter(c.id)}>
                  <span className="pdot" style={{ background: a.urgency === "urgent" ? "var(--danger)" : a.urgency === "high" ? "var(--warning)" : "var(--brand)", width: 8, height: 8, borderRadius: "50%" }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{a.subject}</span>
                  <span className="muted small">{a.dueDate ? formatDate(a.dueDate) : ""}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
              <button className="btn subtle small" onClick={() => enter(c.id)}>Enter workspace →</button>
            </div>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 16 }}>
        Signed in as {me?.user.name}. Cross-client results never include clients outside your assignment.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Client / employee / manager home (UX-01)
// ---------------------------------------------------------------------------
function ClientHome() {
  const { me } = useAuth();
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.home().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Spinner />;

  const isEmployee = data.role === "employee";
  const heading = buildHeading(data, me?.user.name ?? "");

  return (
    <>
      <div className="attention">
        <div className="att-eyebrow">
          {me?.activeClient?.displayName} · {isEmployee ? "Your workspace" : "Needs your attention"}
        </div>
        <h2>{heading}</h2>
        <div className="att-meta">
          <div><div className="m-v">{data.summary.urgent}</div><div className="m-k">Urgent</div></div>
          <div><div className="m-v">{data.summary.high}</div><div className="m-k">Due soon</div></div>
          <div><div className="m-v">{data.summary.total}</div><div className="m-k">{isEmployee ? "Your tasks" : "Open actions"}</div></div>
          {!isEmployee && <div><div className="m-v">{data.peopleInScope}</div><div className="m-k">People in scope</div></div>}
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <div>
          <div className="card-header" style={{ background: "transparent", border: "none", padding: "4px 2px 12px" }}>
            <h3>{isEmployee ? "Your next steps" : "Action stream"}</h3>
          </div>
          <ActionStream actions={data.actions} />
        </div>

        <Card>
          <div className="card-header">
            <h3>Upcoming availability</h3>
            <Pill tone="neutral">{data.upcomingLeave.length}</Pill>
          </div>
          <div className="card-pad" style={{ paddingTop: 8 }}>
            {data.upcomingLeave.length === 0 ? (
              <div className="muted small" style={{ padding: "10px 0" }}>No approved upcoming leave in your scope.</div>
            ) : (
              data.upcomingLeave.map((l) => (
                <div key={l.personId + l.startDate} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
                  <span className="avatar sm">{l.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.name}</div>
                    <div className="muted small">Away</div>
                  </div>
                  <div className="muted small">{formatDate(l.startDate)} → {formatDate(l.endDate)}</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function buildHeading(data: HomePayload, name: string): string {
  const first = name.split(" ")[0];
  if (data.summary.total === 0) {
    return data.role === "employee" ? `You're all caught up, ${first}.` : "Everything in your scope is on track.";
  }
  if (data.role === "employee") {
    return `${first}, you have ${data.summary.total} task${data.summary.total === 1 ? "" : "s"} to complete${data.summary.urgent ? `, ${data.summary.urgent} overdue` : ""}.`;
  }
  return `${data.summary.urgent} urgent and ${data.summary.high} upcoming action${data.summary.high === 1 ? "" : "s"} need attention.`;
}
