import { store } from "./store.js";
import type { ActionItem, ActionUrgency, CredentialRecord } from "./types.js";

const DAY = 86_400_000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
export function daysUntil(date: string): number {
  const d = new Date(date + "T00:00:00Z").getTime();
  const t = new Date(today() + "T00:00:00Z").getTime();
  return Math.round((d - t) / DAY);
}

export type Validity =
  | "no_expiry"
  | "not_yet_valid"
  | "current"
  | "expiring"
  | "expired"
  | "not_applicable";

// CRE-04: validity is independent of verification status.
export function credentialValidity(record: CredentialRecord | null): Validity {
  if (!record) return "not_applicable";
  if (!record.expiryDate) return "no_expiry";
  const d = daysUntil(record.expiryDate);
  if (d < 0) return "expired";
  if (d <= 30) return "expiring";
  return "current";
}

export interface CredentialState {
  verified: CredentialRecord | null; // latest verified evidence drives validity
  pending: CredentialRecord | null; // a submitted renewal awaiting verification
  validity: Validity;
}

// Compute the compliance state for a (person, type). A pending renewal must not
// hide that the currently verified licence has expired (CRE-04).
export function credentialStateFor(
  clientId: string,
  personId: string,
  typeId: string,
): CredentialState {
  const records = store.data.credentialRecords.filter(
    (r) => r.clientId === clientId && r.personId === personId && r.typeId === typeId,
  );
  const verified = records
    .filter((r) => r.verificationStatus === "verified")
    .sort((a, b) => (b.expiryDate ?? "").localeCompare(a.expiryDate ?? ""))[0] ?? null;
  const pending = records.find((r) => r.verificationStatus === "pending") ?? null;
  return { verified, pending, validity: credentialValidity(verified) };
}

function personName(personId: string): string {
  const p = store.data.people.find((x) => x.id === personId);
  return p ? `${p.firstName} ${p.lastName}` : "Unknown";
}

function urgencyFromDue(dueDate: string | null): ActionUrgency {
  if (!dueDate) return "normal";
  const d = daysUntil(dueDate);
  if (d < 0) return "urgent";
  if (d <= 7) return "high";
  return "normal";
}

// Derive the action feed for a client, limited to a set of person ids.
// Answers: what needs attention, who is responsible, what happens next.
export function deriveActions(clientId: string, personIds: Set<string>): ActionItem[] {
  const client = store.data.clients.find((c) => c.id === clientId);
  if (!client) return [];
  const items: ActionItem[] = [];

  // Policy acknowledgements outstanding (POL / ACT)
  if (client.modules.policies === "active" || client.modules.policies === "read_only") {
    for (const pa of store.data.policyAssignments) {
      if (pa.clientId !== clientId) continue;
      if (!personIds.has(pa.personId)) continue;
      if (["acknowledged", "cancelled", "superseded"].includes(pa.state)) continue;
      const policy = store.data.policies.find((p) => p.id === pa.policyId);
      if (!policy) continue;
      const overdue = daysUntil(pa.dueDate) < 0;
      items.push({
        id: `act-pa-${pa.id}`,
        clientId,
        category: "policy_ack",
        module: "policies",
        subject: `Acknowledge “${policy.title}” (v${pa.version})`,
        responsible: personName(pa.personId),
        nextAction: overdue ? "Overdue — read and acknowledge" : "Read and acknowledge",
        reason: overdue ? "Acknowledgement overdue" : "Policy acknowledgement due",
        dueDate: pa.dueDate,
        urgency: urgencyFromDue(pa.dueDate),
        status: pa.state,
        sourceId: pa.id,
        sourcePath: "/policies",
        personId: pa.personId,
      });
    }
  }

  // Credentials: gaps, expiry, verification (CRE)
  if (client.modules.credentials === "active" || client.modules.credentials === "read_only") {
    for (const req of store.data.credentialRequirements) {
      if (req.clientId !== clientId) continue;
      if (!personIds.has(req.personId)) continue;
      const type = store.data.credentialTypes.find((t) => t.id === req.typeId);
      if (!type) continue;
      const state = credentialStateFor(clientId, req.personId, req.typeId);

      if (!state.verified && !state.pending) {
        items.push({
          id: `act-cr-gap-${req.id}`,
          clientId,
          category: "credential_renewal",
          module: "credentials",
          subject: `${type.name} — required, no evidence on file`,
          responsible: personName(req.personId),
          nextAction: "Upload valid evidence",
          reason: "Required credential missing",
          dueDate: null,
          urgency: "high",
          status: "missing",
          sourceId: req.id,
          sourcePath: "/credentials",
          personId: req.personId,
        });
      }

      if (state.verified && state.validity === "expired") {
        items.push({
          id: `act-cr-exp-${state.verified.id}`,
          clientId,
          category: "credential_renewal",
          module: "credentials",
          subject: `${type.name} — expired`,
          responsible: personName(req.personId),
          nextAction: "Renew and submit new evidence",
          reason: `Expired ${Math.abs(daysUntil(state.verified.expiryDate!))} day(s) ago`,
          dueDate: state.verified.expiryDate,
          urgency: "urgent",
          status: "expired",
          sourceId: state.verified.id,
          sourcePath: "/credentials",
          personId: req.personId,
        });
      } else if (state.verified && state.validity === "expiring") {
        items.push({
          id: `act-cr-exp-${state.verified.id}`,
          clientId,
          category: "credential_renewal",
          module: "credentials",
          subject: `${type.name} — expiring in ${daysUntil(state.verified.expiryDate!)} day(s)`,
          responsible: personName(req.personId),
          nextAction: "Plan renewal",
          reason: "Credential expiring soon",
          dueDate: state.verified.expiryDate,
          urgency: "high",
          status: "expiring",
          sourceId: state.verified.id,
          sourcePath: "/credentials",
          personId: req.personId,
        });
      }

      if (state.pending) {
        items.push({
          id: `act-cr-ver-${state.pending.id}`,
          clientId,
          category: "credential_verify",
          module: "credentials",
          subject: `${type.name} — evidence awaiting verification`,
          responsible: type.reviewerRole.replace("_", " "),
          nextAction: "Verify submitted evidence",
          reason: "Pending verification",
          dueDate: null,
          urgency: "normal",
          status: "pending",
          sourceId: state.pending.id,
          sourcePath: "/credentials",
          personId: req.personId,
        });
      }
    }
  }

  // Leave approvals (LEV / ACT)
  if (client.modules.leave === "active" || client.modules.leave === "read_only") {
    for (const lv of store.data.leave) {
      if (lv.clientId !== clientId) continue;
      if (lv.state === "awaiting_approval" && lv.approverPersonId && personIds.has(lv.approverPersonId)) {
        items.push({
          id: `act-lv-appr-${lv.id}`,
          clientId,
          category: "leave_approval",
          module: "leave",
          subject: `Leave request from ${personName(lv.personId)}`,
          responsible: personName(lv.approverPersonId),
          nextAction: "Approve or decline",
          reason: `${lv.leaveType} leave ${lv.startDate} → ${lv.endDate}`,
          dueDate: lv.startDate,
          urgency: urgencyFromDue(lv.startDate),
          status: lv.state,
          sourceId: lv.id,
          sourcePath: "/leave",
          personId: lv.approverPersonId,
        });
      }
    }
  }

  const rank: Record<ActionUrgency, number> = { urgent: 0, high: 1, normal: 2 };
  items.sort((a, b) => {
    if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });
  return items;
}
