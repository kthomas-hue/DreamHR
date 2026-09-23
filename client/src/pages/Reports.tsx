import { useEffect, useState } from "react";
import { api, type ReportsPayload } from "../api";
import { Banner, Card, PageHeader, Pill, Spinner } from "../ui";
import { formatDateTime, titleCase } from "../utils";

export function Reports() {
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.reports().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Spinner />;

  const r = data.reports;

  return (
    <>
      <PageHeader
        eyebrow="Evidence & reporting"
        title="Reports"
        subtitle="Every report states scope, definition and as-at date. Figures reflect only the people in your permission scope."
      />
      <div className="banner info">Scope: {data.scopePeople} people · as at {formatDateTime(data.asAt)}</div>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <ReportCard title="Workforce" definition={r.workforce.definition}>
          <BigStat label="Active assignments" value={r.workforce.data.activeAssignments} />
          <BigStat label="Unique people" value={r.workforce.data.uniquePeople} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {Object.entries(r.workforce.data.byType).map(([k, v]) => (
              <Pill key={k} tone="neutral">{titleCase(k)}: {v}</Pill>
            ))}
          </div>
        </ReportCard>

        <ReportCard title="Policy responses" definition={r.policyResponses.definition}>
          <BigStat label="Issued" value={r.policyResponses.data.issued} />
          <div style={{ display: "flex", gap: 10 }}>
            <Pill tone="success">{r.policyResponses.data.acknowledged} acknowledged</Pill>
            <Pill tone="warning">{r.policyResponses.data.outstanding} outstanding</Pill>
          </div>
        </ReportCard>

        <ReportCard title="Credential gaps" definition={r.credentialGaps.definition}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone="danger">{r.credentialGaps.data.expired} expired</Pill>
            <Pill tone="warning">{r.credentialGaps.data.expiring} expiring</Pill>
            <Pill tone="neutral">{r.credentialGaps.data.missing} missing</Pill>
            <Pill tone="info">{r.credentialGaps.data.pending} pending</Pill>
            <Pill tone="success">{r.credentialGaps.data.current} current</Pill>
          </div>
        </ReportCard>

        <ReportCard title="Leave planner" definition={r.leavePlanner.definition}>
          <div style={{ display: "flex", gap: 10 }}>
            <Pill tone="success">{r.leavePlanner.data.approved} approved</Pill>
            <Pill tone="warning">{r.leavePlanner.data.pending} pending</Pill>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>No entitlement balances are inferred (LEV-01).</div>
        </ReportCard>
      </div>
    </>
  );
}

function ReportCard({ title, definition, children }: { title: string; definition: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="card-header"><h3>{title}</h3></div>
      <div className="card-pad">
        <div className="muted small" style={{ marginBottom: 14 }}>{definition}</div>
        <div style={{ display: "grid", gap: 10 }}>{children}</div>
      </div>
    </Card>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>{value}</span>
      <span className="muted small">{label}</span>
    </div>
  );
}
