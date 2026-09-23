import { useEffect, useMemo, useState } from "react";
import { api, type AvailabilityEntry } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { LeaveRow } from "../types";
import { Banner, Button, Card, EmptyState, Field, Modal, PageHeader, Pill, Spinner } from "../ui";
import { formatDate, titleCase } from "../utils";

const WINDOW_DAYS = 45;
const DAY = 86_400_000;

export function Leave() {
  const { me } = useAuth();
  const [rows, setRows] = useState<LeaveRow[] | null>(null);
  const [avail, setAvail] = useState<AvailabilityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineFor, setDeclineFor] = useState<LeaveRow | null>(null);

  async function load() {
    try {
      const [r, a] = await Promise.all([api.leave(), api.availability()]);
      setRows(r);
      setAvail(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function decide(row: LeaveRow, decision: "approve" | "decline", reason?: string) {
    setBusyId(row.id);
    try {
      await api.decideLeave(row.id, decision, reason);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
      setDeclineFor(null);
    }
  }

  const overlaps = useMemo(() => detectOverlaps(avail ?? []), [avail]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!rows || !avail) return <Spinner />;

  return (
    <>
      <PageHeader
        eyebrow="Holiday planner"
        title="Leave"
        subtitle="Requests, approvals and team availability. Colleagues see only “Away” — never the reason or leave type."
        actions={me?.personId ? <Button onClick={() => setShowRequest(true)}>+ Request leave</Button> : undefined}
      />

      <Card style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>Team availability · next {WINDOW_DAYS} days</h3>
        </div>
        <div className="card-pad">
          {avail.length === 0 ? (
            <div className="muted small">No upcoming absence in your scope.</div>
          ) : (
            <AvailabilityCalendar entries={avail} />
          )}
          {overlaps.length > 0 && (
            <div className="overlap-warn">⚠ Overlapping absence: {overlaps.join("; ")}. Check coverage before approving.</div>
          )}
        </div>
      </Card>

      <Card>
        <div className="card-header"><h3>Requests</h3></div>
        {rows.length === 0 ? (
          <EmptyState icon="◷" title="No leave requests in your scope" />
        ) : (
          <table className="table">
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Duration</th><th>Status</th><th className="right">Action</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.personName}{r.isMine && <span className="muted small"> · you</span>}</td>
                  <td>{titleCase(r.leaveType)}</td>
                  <td>{formatDate(r.startDate)}{r.startDate !== r.endDate ? ` → ${formatDate(r.endDate)}` : ""}</td>
                  <td className="muted">{r.partialDay ? `${r.hours ?? "?"}h partial` : "Full day"}</td>
                  <td><Pill tone={r.state === "approved" ? "success" : r.state === "declined" ? "danger" : "warning"}>{titleCase(r.state)}</Pill></td>
                  <td className="right">
                    {r.canDecide ? (
                      <span style={{ display: "inline-flex", gap: 8 }}>
                        <Button small variant="ghost" disabled={busyId === r.id} onClick={() => setDeclineFor(r)}>Decline</Button>
                        <Button small disabled={busyId === r.id} onClick={() => decide(r, "approve")}>Approve</Button>
                      </span>
                    ) : (
                      <span className="muted small">{r.approver ? `Approver: ${r.approver}` : "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showRequest && (
        <RequestModal
          onClose={() => setShowRequest(false)}
          onDone={async () => {
            setShowRequest(false);
            await load();
          }}
        />
      )}
      {declineFor && (
        <DeclineModal
          row={declineFor}
          busy={busyId === declineFor.id}
          onClose={() => setDeclineFor(null)}
          onConfirm={(reason) => decide(declineFor, "decline", reason)}
        />
      )}
    </>
  );
}

function AvailabilityCalendar({ entries }: { entries: AvailabilityEntry[] }) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const totalMs = WINDOW_DAYS * DAY;
  const byPerson = new Map<string, AvailabilityEntry[]>();
  for (const e of entries) {
    const arr = byPerson.get(e.name) ?? [];
    arr.push(e);
    byPerson.set(e.name, arr);
  }
  return (
    <div className="cal">
      {[...byPerson.entries()].map(([name, es]) => (
        <div className="cal-row" key={name}>
          <div className="cal-name">{name}</div>
          <div className="cal-track">
            {es.map((e, i) => {
              const s = new Date(e.startDate + "T00:00:00Z").getTime();
              const en = new Date(e.endDate + "T00:00:00Z").getTime() + DAY;
              const left = Math.max(0, ((s - startMs) / totalMs) * 100);
              const width = Math.max(3, Math.min(100 - left, ((en - s) / totalMs) * 100));
              return (
                <div key={i} className={`cal-bar ${e.pending ? "pending" : ""}`} style={{ left: `${left}%`, width: `${width}%` }}>
                  {e.label}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function detectOverlaps(entries: AvailabilityEntry[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.name === b.name) continue;
      if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
        out.push(`${a.name} & ${b.name}`);
      }
    }
  }
  return [...new Set(out)];
}

const LEAVE_TYPES = ["annual", "personal", "unpaid", "compassionate", "long_service"];

function RequestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [leaveType, setLeaveType] = useState("annual");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [partialDay, setPartial] = useState(false);
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.requestLeave({
        leaveType,
        startDate,
        endDate: partialDay ? startDate : endDate,
        partialDay,
        hours: partialDay ? Number(hours) || undefined : undefined,
        reason: reason || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Request leave"
      description="Your request is routed to your manager for approval. You cannot approve your own leave."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !startDate || (!partialDay && !endDate)}>{busy ? "Submitting…" : "Submit request"}</Button>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <Field label="Leave type" required>
          <select className="select" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </select>
        </Field>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={partialDay} onChange={(e) => setPartial(e.target.checked)} />
          <span style={{ fontSize: 13.5 }}>Partial day (specify hours — no standard week is assumed)</span>
        </label>
        <div className="grid cols-2">
          <Field label={partialDay ? "Date" : "Start date"} required>
            <input className="input" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          {partialDay ? (
            <Field label="Hours" required>
              <input className="input" type="number" min={0.5} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
          ) : (
            <Field label="End date" required>
              <input className="input" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required />
            </Field>
          )}
        </div>
        <Field label="Reason (private — not shown to colleagues)">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
        </Field>
      </form>
    </Modal>
  );
}

function DeclineModal({ row, busy, onClose, onConfirm }: { row: LeaveRow; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title={`Decline leave — ${row.personName}`}
      description="A reason is required to decline."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={() => onConfirm(reason)} disabled={busy || !reason}>Decline request</Button>
        </>
      }
    >
      <Field label="Reason" required>
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}
