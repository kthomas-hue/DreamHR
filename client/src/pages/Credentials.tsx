import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { CredentialRow } from "../types";
import { Banner, Button, Card, EmptyState, Field, Modal, PageHeader, Pill, Spinner } from "../ui";
import { formatDate, titleCase } from "../utils";

const VALIDITY_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  current: "success", no_expiry: "success", expiring: "warning", expired: "danger", not_applicable: "neutral", not_yet_valid: "info",
};
const VERIF_TONE: Record<string, "success" | "info" | "danger" | "neutral"> = {
  verified: "success", pending: "info", rejected: "danger", unsubmitted: "neutral",
};

export function Credentials() {
  const [rows, setRows] = useState<CredentialRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renewRow, setRenewRow] = useState<CredentialRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await api.credentials());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const r = rows ?? [];
    return {
      missing: r.filter((x) => x.verification === "unsubmitted" && !x.verifiedRecordId).length,
      expired: r.filter((x) => x.validity === "expired").length,
      expiring: r.filter((x) => x.validity === "expiring").length,
      pending: r.filter((x) => x.verification === "pending").length,
    };
  }, [rows]);

  async function verify(row: CredentialRow, decision: "verify" | "reject") {
    if (!row.pendingRecordId) return;
    setBusyId(row.requirementId);
    try {
      await api.verifyCredential(row.pendingRecordId, decision, decision === "reject" ? "Returned for correction" : undefined);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!rows) return <Spinner />;

  return (
    <>
      <PageHeader
        eyebrow="Certificates & licences"
        title="Credentials"
        subtitle="Validity and verification are tracked separately. A pending renewal never hides that a licence has expired."
      />

      <div className="stat-row" style={{ marginBottom: 20 }}>
        <div className="stat accent-urgent"><div className="stat-k">Expired</div><div className="stat-v">{summary.expired}</div></div>
        <div className="stat accent-high"><div className="stat-k">Expiring ≤30 days</div><div className="stat-v">{summary.expiring}</div></div>
        <div className="stat accent-brand"><div className="stat-k">Missing evidence</div><div className="stat-v">{summary.missing}</div></div>
        <div className="stat accent-ok"><div className="stat-k">Awaiting verification</div><div className="stat-v">{summary.pending}</div></div>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="✦" title="No credential requirements in your scope" />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Credential</th><th>Holder</th><th>Validity</th><th>Verification</th><th>Expiry</th><th className="right">Action</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hasEvidence = r.verifiedRecordId || r.pendingRecordId;
                return (
                  <tr key={r.requirementId}>
                    <td style={{ fontWeight: 600 }}>{r.type}<div className="muted small">{r.issuer} · {r.jurisdiction}</div></td>
                    <td>{r.personName}</td>
                    <td>
                      {hasEvidence ? (
                        <Pill tone={VALIDITY_TONE[r.validity] ?? "neutral"}>{titleCase(r.validity)}</Pill>
                      ) : (
                        <Pill tone="danger">Missing</Pill>
                      )}
                    </td>
                    <td><Pill tone={VERIF_TONE[r.verification] ?? "neutral"}>{titleCase(r.verification)}</Pill></td>
                    <td className="muted">{formatDate(r.expiryDate)}</td>
                    <td className="right">
                      {r.canVerify && (
                        <span style={{ display: "inline-flex", gap: 8 }}>
                          <Button small variant="ghost" disabled={busyId === r.requirementId} onClick={() => verify(r, "reject")}>Return</Button>
                          <Button small disabled={busyId === r.requirementId} onClick={() => verify(r, "verify")}>Verify</Button>
                        </span>
                      )}
                      {r.isMine && (r.validity === "expired" || r.validity === "expiring" || !hasEvidence) && (
                        <Button small onClick={() => setRenewRow(r)}>Submit renewal</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {renewRow && (
        <RenewModal
          row={renewRow}
          onClose={() => setRenewRow(null)}
          onDone={async () => {
            setRenewRow(null);
            await load();
          }}
        />
      )}
    </>
  );
}

function RenewModal({ row, onClose, onDone }: { row: CredentialRow; onClose: () => void; onDone: () => void }) {
  const [expiry, setExpiry] = useState("");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.renewCredential(row.requirementId, expiry, number || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Renew: ${row.type}`}
      description="Submitting creates a new record awaiting verification. Your current evidence stays visible until the renewal is verified."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !expiry}>{busy ? "Submitting…" : "Submit for verification"}</Button>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <Field label="New expiry date" required>
          <input className="input" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} required />
        </Field>
        <Field label="Credential / licence number">
          <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="banner info" style={{ margin: 0 }}>Evidence file upload is stubbed in this build (attaches a placeholder document).</div>
      </form>
    </Modal>
  );
}
