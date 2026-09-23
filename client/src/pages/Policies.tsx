import { useEffect, useMemo, useState } from "react";
import { api, type AckEvidence, type EvidenceBundle } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { PolicyRow } from "../types";
import { Banner, Button, Card, EmptyState, Modal, PageHeader, Pill, Spinner } from "../ui";
import { formatDate, formatDateTime, titleCase } from "../utils";

const ACK_STATEMENT =
  "I confirm I have read and understood this policy. I understand this records receipt and understanding, not agreement to contractual terms.";

export function Policies() {
  const { me } = useAuth();
  const [rows, setRows] = useState<PolicyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ackRow, setAckRow] = useState<PolicyRow | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<PolicyRow | null>(null);

  const canExport = me?.role && ["client_admin", "consultant", "platform_owner"].includes(me.role);

  async function load() {
    try {
      setRows(await api.policies());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const mine = useMemo(() => (rows ?? []).filter((r) => r.isMine), [rows]);
  const others = useMemo(() => (rows ?? []).filter((r) => !r.isMine), [rows]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!rows) return <Spinner />;

  return (
    <>
      <PageHeader
        eyebrow="Policies"
        title="Policies & acknowledgements"
        subtitle="Read and acknowledge assigned policies. Acknowledgement records receipt and understanding — not agreement to contractual terms."
      />

      {mine.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>Assigned to you</h3></div>
          <table className="table">
            <thead><tr><th>Policy</th><th>Version</th><th>Due</th><th>Status</th><th className="right">Action</th></tr></thead>
            <tbody>
              {mine.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.title}<div className="muted small">{r.category}</div></td>
                  <td>v{r.version}</td>
                  <td>{r.overdue ? <Pill tone="danger">Overdue {formatDate(r.dueDate)}</Pill> : formatDate(r.dueDate)}</td>
                  <td><Pill tone={r.state === "acknowledged" ? "success" : "warning"}>{titleCase(r.state)}</Pill></td>
                  <td className="right">
                    {r.state === "acknowledged" ? (
                      <span className="muted small">Done</span>
                    ) : (
                      <Button small onClick={() => setAckRow(r)}>Read &amp; acknowledge</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <div className="card-header">
          <h3>{mine.length > 0 ? "Team & organisation" : "Policy assignments"}</h3>
        </div>
        {others.length === 0 ? (
          <EmptyState icon="▤" title="No assignments in your scope" />
        ) : (
          <table className="table">
            <thead><tr><th>Policy</th><th>Person</th><th>Version</th><th>Due</th><th>Status</th>{canExport && <th className="right">Evidence</th>}</tr></thead>
            <tbody>
              {others.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.title}</td>
                  <td>{r.personName}</td>
                  <td>v{r.version}</td>
                  <td>{r.overdue ? <Pill tone="danger">Overdue</Pill> : formatDate(r.dueDate)}</td>
                  <td><Pill tone={r.state === "acknowledged" ? "success" : "warning"}>{titleCase(r.state)}</Pill></td>
                  {canExport && (
                    <td className="right">
                      <Button variant="ghost" small onClick={() => setEvidenceFor(r)}>View</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {ackRow && (
        <AcknowledgeModal
          row={ackRow}
          onClose={() => setAckRow(null)}
          onDone={async () => {
            setAckRow(null);
            await load();
          }}
        />
      )}
      {evidenceFor && <EvidenceModal policyId={evidenceFor.policyId} onClose={() => setEvidenceFor(null)} />}
    </>
  );
}

function AcknowledgeModal({ row, onClose, onDone }: { row: PolicyRow; onClose: () => void; onDone: () => void }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<AckEvidence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mark opened (assigned -> opened) when the policy is viewed.
    api.openPolicy(row.id).catch(() => undefined);
  }, [row.id]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.acknowledge(row.id, ACK_STATEMENT);
      setReceipt(res.acknowledgement ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <Modal title="Acknowledgement recorded" onClose={onDone} footer={<Button onClick={onDone}>Done</Button>}>
        <div className="banner info" style={{ display: "flex", gap: 10 }}>
          <span>✓</span>
          <span>Immutable evidence has been recorded. A later policy edit cannot alter this record.</span>
        </div>
        <div className="detail-grid" style={{ marginTop: 12 }}>
          <div><div className="dk">Statement</div><div className="dv" style={{ fontSize: 13 }}>{receipt.statementText}</div></div>
          <div><div className="dk">Recorded at</div><div className="dv">{formatDateTime(receipt.timestampUtc)}</div></div>
          <div><div className="dk">Policy version</div><div className="dv">v{receipt.version}</div></div>
          <div><div className="dk">Policy hash</div><div className="dv mono">{receipt.policyHash}</div></div>
          <div><div className="dk">Session</div><div className="dv mono">{receipt.sessionId}</div></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={row.title}
      description={`Version ${row.version} · ${row.category}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={confirm} disabled={!checked || busy}>{busy ? "Recording…" : "Acknowledge"}</Button>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div className="muted small" style={{ marginBottom: 6 }}>Policy summary</div>
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{row.summary}</div>
        <div className="muted small mono" style={{ marginTop: 10 }}>Document hash: {row.hash}</div>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 3 }} />
        <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>{ACK_STATEMENT}</span>
      </label>
    </Modal>
  );
}

function EvidenceModal({ policyId, onClose }: { policyId: string; onClose: () => void }) {
  const [bundle, setBundle] = useState<EvidenceBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.policyEvidence(policyId).then(setBundle).catch((e) => setError(e.message));
  }, [policyId]);

  return (
    <Modal title="Policy evidence bundle" onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      {error && <Banner tone="error">{error}</Banner>}
      {!bundle ? (
        <Spinner />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <Pill tone="success">{bundle.acknowledged} acknowledged</Pill>
            <Pill tone="warning">{bundle.outstanding} outstanding</Pill>
            <span className="muted small" style={{ alignSelf: "center" }}>as at {formatDateTime(bundle.asAt)}</span>
          </div>
          <table className="table">
            <thead><tr><th>Person</th><th>State</th><th>Acknowledged</th><th>Hash</th></tr></thead>
            <tbody>
              {bundle.population.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{p.person}</td>
                  <td><Pill tone={p.state === "acknowledged" ? "success" : "warning"}>{titleCase(p.state)}</Pill></td>
                  <td className="muted small">{p.acknowledgedAt ? formatDateTime(p.acknowledgedAt) : "—"}</td>
                  <td className="mono small">{p.policyHash ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
