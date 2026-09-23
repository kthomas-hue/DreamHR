import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { deriveActions, credentialStateFor, credentialValidity, daysUntil } from "./actions.js";
import {
  accessibleClientIds,
  buildContext,
  canAccessModule,
  canSeeLeaveReason,
  canSeeRemuneration,
  canSeeRestrictedHrDocs,
  membershipFor,
  personIdsInScope,
  portfolioClientIds,
  roleCan,
  type AuthContext,
} from "./authz.js";
import { store } from "./store.js";
import type { LeaveType, ModuleKey, PaletteKey } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const COOKIE = "dhr_session";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// -- Cookie helpers ---------------------------------------------------------
function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}
function setSessionCookie(res: Response, token: string) {
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/`);
}
function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

// -- Auth middleware --------------------------------------------------------
interface AuthedRequest extends Request {
  ctx?: AuthContext;
}

function attachContext(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = parseCookies(req)[COOKIE];
  const session = store.getSession(token);
  if (session) {
    const ctx = buildContext(session);
    if (ctx) req.ctx = ctx;
  }
  next();
}
app.use(attachContext);

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.ctx) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// Require an active client context (client users + staff who have switched in).
function requireClient(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.ctx) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!req.ctx.clientId || !req.ctx.role) {
    res.status(403).json({ error: "No active client selected" });
    return;
  }
  next();
}

// -- Health -----------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "dreamhr-api", time: new Date().toISOString() });
});

app.post("/api/dev/reset", (_req, res) => {
  store.reset();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const user = store.data.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || user.password !== password) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const session = store.createSession(user.id);
  const clientIds = accessibleClientIds(user);
  if (clientIds.length === 1) session.activeClientId = clientIds[0];
  setSessionCookie(res, session.token);
  store.record(user.id, session.activeClientId, "login", "session", user.email);
  res.json({ ok: true });
});

app.post("/api/auth/logout", (req: AuthedRequest, res) => {
  const token = parseCookies(req)[COOKIE];
  if (token) store.deleteSession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

function clientSummary(clientId: string) {
  const c = store.data.clients.find((x) => x.id === clientId)!;
  return {
    id: c.id,
    tradingName: c.tradingName,
    displayName: c.branding.displayName,
    logoText: c.branding.logoText,
    palette: c.branding.palette,
    status: c.status,
    modules: c.modules,
  };
}

app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const clientIds = accessibleClientIds(ctx.user);
  res.json({
    user: { id: ctx.user.id, name: ctx.user.fullName, email: ctx.user.email, isDreamStone: ctx.user.isDreamStone },
    activeClientId: ctx.clientId,
    role: ctx.role,
    personId: ctx.personId,
    clients: clientIds.map(clientSummary),
    activeClient: ctx.clientId ? clientSummary(ctx.clientId) : null,
  });
});

app.post("/api/auth/switch-client", requireAuth, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const { clientId } = req.body as { clientId?: string | null };
  // DreamStoneHR staff may clear the active client to return to the portfolio.
  if ((clientId === null || clientId === undefined) && ctx.user.isDreamStone) {
    ctx.session.activeClientId = null;
    res.json({ ok: true, activeClient: null });
    return;
  }
  if (!clientId || !accessibleClientIds(ctx.user).includes(clientId)) {
    res.status(403).json({ error: "Not permitted for this client" });
    return;
  }
  ctx.session.activeClientId = clientId;
  store.record(ctx.user.id, clientId, "switch_client", "session", clientId);
  res.json({ ok: true, activeClient: clientSummary(clientId) });
});

// ---------------------------------------------------------------------------
// Portfolio (DreamStoneHR) — cross-client operating queue (ADM-01)
// ---------------------------------------------------------------------------
app.get("/api/portfolio", requireAuth, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!ctx.isDreamStone) {
    res.status(403).json({ error: "DreamStoneHR staff only" });
    return;
  }
  const ids = portfolioClientIds(ctx.user.id); // never unassigned clients
  const clients = ids.map((clientId) => {
    const c = store.data.clients.find((x) => x.id === clientId)!;
    const allPeople = new Set(store.data.people.filter((p) => p.clientId === clientId).map((p) => p.id));
    const actions = deriveActions(clientId, allPeople);
    return {
      ...clientSummary(clientId),
      legalName: c.legalName,
      timezone: c.timezone,
      counts: {
        urgent: actions.filter((a) => a.urgency === "urgent").length,
        high: actions.filter((a) => a.urgency === "high").length,
        total: actions.length,
        people: allPeople.size,
      },
      topActions: actions.slice(0, 4),
    };
  });
  const flat = clients.flatMap((c) => c.topActions);
  res.json({
    clients,
    totals: {
      urgent: clients.reduce((s, c) => s + c.counts.urgent, 0),
      high: clients.reduce((s, c) => s + c.counts.high, 0),
      clients: clients.length,
    },
    stream: flat.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")).slice(0, 12),
  });
});

// ---------------------------------------------------------------------------
// Role-aware home (UX-01) + shared action centre
// ---------------------------------------------------------------------------
app.get("/api/home", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const scope = personIdsInScope(ctx);
  const actions = deriveActions(ctx.clientId!, scope);

  const upcomingLeave = store.data.leave
    .filter((l) => l.clientId === ctx.clientId && l.state === "approved" && l.endDate >= new Date().toISOString().slice(0, 10) && scope.has(l.personId))
    .map((l) => ({ personId: l.personId, name: personName(l.personId), startDate: l.startDate, endDate: l.endDate }))
    .slice(0, 6);

  res.json({
    role: ctx.role,
    actions,
    summary: {
      urgent: actions.filter((a) => a.urgency === "urgent").length,
      high: actions.filter((a) => a.urgency === "high").length,
      total: actions.length,
    },
    upcomingLeave,
    peopleInScope: scope.size,
  });
});

app.get("/api/actions", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const scope = personIdsInScope(ctx);
  res.json(deriveActions(ctx.clientId!, scope));
});

// ---------------------------------------------------------------------------
// People directory + profile (PEO / DOC)
// ---------------------------------------------------------------------------
function personName(personId: string): string {
  const p = store.data.people.find((x) => x.id === personId);
  return p ? `${p.firstName} ${p.lastName}` : "Unknown";
}

function personListDto(ctx: AuthContext, personId: string) {
  const p = store.data.people.find((x) => x.id === personId)!;
  const e = store.data.employments.find((x) => x.personId === personId && x.clientId === ctx.clientId);
  const site = e ? store.data.sites.find((s) => s.id === e.siteId) : undefined;
  const team = e ? store.data.teams.find((t) => t.id === e.teamId) : undefined;
  return {
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    firstName: p.firstName,
    lastName: p.lastName,
    title: e?.title ?? "—",
    team: team?.name ?? "—",
    site: site?.name ?? "—",
    status: e?.status ?? "active",
    employmentType: e?.employmentType ?? "permanent",
    workEmail: p.workEmail,
  };
}

app.get("/api/people", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!canAccessModule(ctx, "people", false)) {
    res.status(403).json({ error: "Module unavailable" });
    return;
  }
  const scope = personIdsInScope(ctx);
  const list = [...scope]
    .map((id) => personListDto(ctx, id))
    .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  res.json(list);
});

app.get("/api/people/:id", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const scope = personIdsInScope(ctx);
  const id = req.params.id;
  if (!scope.has(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const p = store.data.people.find((x) => x.id === id && x.clientId === ctx.clientId);
  if (!p) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const e = store.data.employments.find((x) => x.personId === id && x.clientId === ctx.clientId)!;
  const site = store.data.sites.find((s) => s.id === e.siteId);
  const team = store.data.teams.find((t) => t.id === e.teamId);
  const entity = store.data.entities.find((en) => en.id === e.entityId);
  const manager = e.managerPersonId ? personName(e.managerPersonId) : null;

  const showRemuneration = canSeeRemuneration(ctx, p);
  const docs = store.data.documents
    .filter((d) => d.personId === id && d.clientId === ctx.clientId)
    .filter((d) => {
      if (d.category === "restricted_hr") return canSeeRestrictedHrDocs(ctx);
      if (d.category === "manager_visible") return ctx.role !== "employee";
      return d.released || ctx.role === "client_admin";
    })
    .map((d) => ({ id: d.id, title: d.title, category: d.category, version: d.version, issueDate: d.issueDate, released: d.released }));

  const policies = store.data.policyAssignments
    .filter((pa) => pa.personId === id && pa.clientId === ctx.clientId)
    .map((pa) => {
      const pol = store.data.policies.find((x) => x.id === pa.policyId)!;
      return { id: pa.id, title: pol.title, version: pa.version, state: pa.state, dueDate: pa.dueDate };
    });

  const credentials = store.data.credentialRequirements
    .filter((r) => r.personId === id && r.clientId === ctx.clientId)
    .map((r) => {
      const type = store.data.credentialTypes.find((t) => t.id === r.typeId)!;
      const st = credentialStateFor(ctx.clientId!, id, r.typeId);
      return {
        type: type.name,
        validity: st.validity,
        verification: st.pending ? "pending" : st.verified ? "verified" : "unsubmitted",
        expiryDate: st.verified?.expiryDate ?? null,
      };
    });

  const leave = store.data.leave
    .filter((l) => l.personId === id && l.clientId === ctx.clientId)
    .map((l) => ({
      id: l.id,
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      state: l.state,
      reason: canSeeLeaveReason(ctx, l) ? l.reason : null,
    }));

  res.json({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    preferredName: p.preferredName,
    workEmail: p.workEmail,
    phone: p.phone,
    location: p.location,
    emergencyContact: ctx.role === "employee" && ctx.personId !== id ? null : p.emergencyContact,
    employment: {
      title: e.title,
      entity: entity?.name ?? "—",
      site: site?.name ?? "—",
      team: team?.name ?? "—",
      manager,
      status: e.status,
      employmentType: e.employmentType,
      startDate: e.startDate,
      endDate: e.endDate,
      ordinaryHours: e.ordinaryHours,
      fte: e.fte,
      probationDate: e.probationDate,
    },
    remuneration: showRemuneration
      ? { amount: e.remuneration.amount, basis: e.remuneration.basis, currency: e.remuneration.currency, superInclusive: e.remuneration.superInclusive, effectiveDate: e.remuneration.effectiveDate }
      : null,
    documents: docs,
    policies,
    credentials,
    leave,
  });
});

// ---------------------------------------------------------------------------
// Policies (POL) — assignment + acknowledgement evidence
// ---------------------------------------------------------------------------
app.get("/api/policies", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!canAccessModule(ctx, "policies", false)) {
    res.status(403).json({ error: "Module unavailable" });
    return;
  }
  const scope = personIdsInScope(ctx);
  const assignments = store.data.policyAssignments
    .filter((pa) => pa.clientId === ctx.clientId && scope.has(pa.personId))
    .map((pa) => {
      const pol = store.data.policies.find((p) => p.id === pa.policyId)!;
      const overdue = daysUntil(pa.dueDate) < 0 && pa.state !== "acknowledged";
      return {
        id: pa.id,
        policyId: pol.id,
        title: pol.title,
        category: pol.category,
        version: pa.version,
        personId: pa.personId,
        personName: personName(pa.personId),
        dueDate: pa.dueDate,
        state: pa.state,
        overdue,
        summary: pol.versions.find((v) => v.version === pa.version)?.summary ?? "",
        hash: pol.versions.find((v) => v.version === pa.version)?.hash ?? "",
        isMine: pa.personId === ctx.personId,
      };
    });
  res.json(assignments);
});

app.post("/api/policies/:assignmentId/open", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const pa = store.data.policyAssignments.find((x) => x.id === req.params.assignmentId && x.clientId === ctx.clientId);
  if (!pa) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (pa.personId !== ctx.personId) {
    res.status(403).json({ error: "Only the assignee can open this policy" });
    return;
  }
  if (pa.state === "assigned") {
    pa.state = "opened";
    pa.openedAt = new Date().toISOString();
  }
  res.json({ ok: true, state: pa.state });
});

app.post("/api/policies/:assignmentId/acknowledge", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!roleCan(ctx.role!, "acknowledge")) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const pa = store.data.policyAssignments.find((x) => x.id === req.params.assignmentId && x.clientId === ctx.clientId);
  if (!pa) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // POL-04/SEC-05: cannot acknowledge on another person's behalf.
  if (pa.personId !== ctx.personId) {
    res.status(403).json({ error: "You can only acknowledge your own assignments" });
    return;
  }
  const policy = store.data.policies.find((p) => p.id === pa.policyId)!;
  const version = policy.versions.find((v) => v.version === pa.version)!;

  // Dedup: repeated confirmation produces one acknowledgement (POL evidence rules).
  const existing = store.data.acknowledgements.find((a) => a.assignmentId === pa.id);
  if (existing) {
    res.json({ ok: true, alreadyAcknowledged: true, acknowledgement: redactAck(existing) });
    return;
  }
  const { statement } = req.body as { statement?: string };
  if (!statement) {
    res.status(400).json({ error: "An explicit acknowledgement statement is required" });
    return;
  }
  const ack = {
    id: store.newId("ack"),
    assignmentId: pa.id,
    clientId: ctx.clientId!,
    personId: pa.personId,
    statementText: String(statement),
    timestampUtc: new Date().toISOString(),
    policyHash: version.hash,
    version: pa.version,
    sessionId: ctx.session.token.slice(0, 8),
  };
  store.data.acknowledgements.push(ack);
  pa.state = "acknowledged";
  store.record(ctx.user.id, ctx.clientId!, "acknowledge_policy", pa.id, `${policy.title} v${pa.version}`);
  res.json({ ok: true, acknowledgement: redactAck(ack) });
});

function redactAck(a: { id: string; statementText: string; timestampUtc: string; policyHash: string; version: number; sessionId: string }) {
  return {
    id: a.id,
    statementText: a.statementText,
    timestampUtc: a.timestampUtc,
    policyHash: a.policyHash,
    version: a.version,
    sessionId: a.sessionId,
  };
}

// Evidence bundle (POL acceptance evidence) — authorised users only.
app.get("/api/policies/:policyId/evidence", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!roleCan(ctx.role!, "export")) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const policy = store.data.policies.find((p) => p.id === req.params.policyId && p.clientId === ctx.clientId);
  if (!policy) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const assignments = store.data.policyAssignments.filter((pa) => pa.policyId === policy.id && pa.clientId === ctx.clientId);
  const population = assignments.map((pa) => {
    const ack = store.data.acknowledgements.find((a) => a.assignmentId === pa.id);
    return {
      person: personName(pa.personId),
      version: pa.version,
      state: pa.state,
      dueDate: pa.dueDate,
      acknowledgedAt: ack?.timestampUtc ?? null,
      statement: ack?.statementText ?? null,
      policyHash: ack?.policyHash ?? null,
    };
  });
  res.json({
    policy: { title: policy.title, category: policy.category, currentVersion: policy.currentVersion },
    asAt: new Date().toISOString(),
    acknowledged: population.filter((p) => p.state === "acknowledged").length,
    outstanding: population.filter((p) => p.state !== "acknowledged").length,
    population,
  });
});

// ---------------------------------------------------------------------------
// Credentials (CRE)
// ---------------------------------------------------------------------------
app.get("/api/credentials", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!canAccessModule(ctx, "credentials", false)) {
    res.status(403).json({ error: "Module unavailable" });
    return;
  }
  const scope = personIdsInScope(ctx);
  const rows = store.data.credentialRequirements
    .filter((r) => r.clientId === ctx.clientId && scope.has(r.personId))
    .map((r) => {
      const type = store.data.credentialTypes.find((t) => t.id === r.typeId)!;
      const st = credentialStateFor(ctx.clientId!, r.personId, r.typeId);
      return {
        requirementId: r.id,
        typeId: type.id,
        type: type.name,
        issuer: type.issuer,
        jurisdiction: type.jurisdiction,
        personId: r.personId,
        personName: personName(r.personId),
        validity: st.validity,
        verification: st.pending ? "pending" : st.verified ? "verified" : "unsubmitted",
        expiryDate: st.verified?.expiryDate ?? null,
        pendingRecordId: st.pending?.id ?? null,
        verifiedRecordId: st.verified?.id ?? null,
        isMine: r.personId === ctx.personId,
        canVerify: (ctx.role === "client_admin" || ctx.role === "manager" || ctx.role === "consultant") && !!st.pending,
      };
    });
  res.json(rows);
});

// Employee submits a renewal (creates a pending record; keeps prior evidence).
app.post("/api/credentials/renew", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const { requirementId, expiryDate, number } = req.body as { requirementId?: string; expiryDate?: string; number?: string };
  const req0 = store.data.credentialRequirements.find((r) => r.id === requirementId && r.clientId === ctx.clientId);
  if (!req0) {
    res.status(404).json({ error: "Requirement not found" });
    return;
  }
  if (ctx.personId !== req0.personId && ctx.role !== "client_admin") {
    res.status(403).json({ error: "You can only submit your own credential" });
    return;
  }
  if (!expiryDate) {
    res.status(400).json({ error: "Expiry date is required" });
    return;
  }
  const rec = {
    id: store.newId("cd"),
    clientId: ctx.clientId!,
    personId: req0.personId,
    typeId: req0.typeId,
    number: number ?? null,
    issueDate: new Date().toISOString().slice(0, 10),
    expiryDate,
    evidenceFileName: "renewal-evidence.pdf",
    verificationStatus: "pending" as const,
    verifier: null,
    verificationDate: null,
    conditions: null,
    supersededBy: null,
  };
  store.data.credentialRecords.push(rec);
  store.record(ctx.user.id, ctx.clientId!, "credential_renew", rec.id, req0.typeId);
  res.status(201).json({ ok: true });
});

// Reviewer verifies or rejects a pending submission.
app.post("/api/credentials/:recordId/verify", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!(ctx.role === "client_admin" || ctx.role === "manager" || ctx.role === "consultant")) {
    res.status(403).json({ error: "Not permitted to verify" });
    return;
  }
  const rec = store.data.credentialRecords.find((r) => r.id === req.params.recordId && r.clientId === ctx.clientId);
  if (!rec) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { decision, reason } = req.body as { decision?: "verify" | "reject"; reason?: string };
  if (decision === "verify") {
    rec.verificationStatus = "verified";
    rec.verifier = ctx.user.fullName;
    rec.verificationDate = new Date().toISOString().slice(0, 10);
  } else if (decision === "reject") {
    rec.verificationStatus = "rejected";
    rec.verifier = ctx.user.fullName;
    rec.conditions = reason ?? "Returned for correction";
  } else {
    res.status(400).json({ error: "decision must be verify or reject" });
    return;
  }
  store.record(ctx.user.id, ctx.clientId!, "credential_verify", rec.id, decision ?? "");
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Leave (LEV) — request, approval, availability
// ---------------------------------------------------------------------------
app.get("/api/leave", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!canAccessModule(ctx, "leave", false)) {
    res.status(403).json({ error: "Module unavailable" });
    return;
  }
  const scope = personIdsInScope(ctx);
  const rows = store.data.leave
    .filter((l) => l.clientId === ctx.clientId && (scope.has(l.personId) || l.approverPersonId === ctx.personId))
    .map((l) => ({
      id: l.id,
      personId: l.personId,
      personName: personName(l.personId),
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      partialDay: l.partialDay,
      hours: l.hours,
      state: l.state,
      approver: l.approverPersonId ? personName(l.approverPersonId) : null,
      reason: canSeeLeaveReason(ctx, l) ? l.reason : null,
      isMine: l.personId === ctx.personId,
      canDecide: l.state === "awaiting_approval" && l.approverPersonId === ctx.personId && l.personId !== ctx.personId,
    }));
  res.json(rows);
});

// Privacy-safe availability calendar (LEV-05): colleagues see only "Away".
app.get("/api/leave/availability", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!canAccessModule(ctx, "leave", false)) {
    res.status(403).json({ error: "Module unavailable" });
    return;
  }
  const scope = personIdsInScope(ctx);
  const entries = store.data.leave
    .filter((l) => l.clientId === ctx.clientId && ["approved", "awaiting_approval"].includes(l.state) && scope.has(l.personId))
    .map((l) => ({
      personId: l.personId,
      name: personName(l.personId),
      startDate: l.startDate,
      endDate: l.endDate,
      label: "Away", // never expose leave type or reason to colleagues
      pending: l.state === "awaiting_approval",
    }));
  res.json(entries);
});

app.post("/api/leave", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!canAccessModule(ctx, "leave", true)) {
    res.status(403).json({ error: "Module unavailable" });
    return;
  }
  if (!ctx.personId) {
    res.status(403).json({ error: "Only employees with a person record can request leave" });
    return;
  }
  const { leaveType, startDate, endDate, partialDay, hours, reason } = req.body as {
    leaveType?: LeaveType; startDate?: string; endDate?: string; partialDay?: boolean; hours?: number; reason?: string;
  };
  if (!leaveType || !startDate || !endDate) {
    res.status(400).json({ error: "leaveType, startDate and endDate are required" });
    return;
  }
  if (endDate < startDate) {
    res.status(400).json({ error: "End date cannot be before start date" });
    return;
  }
  // Route to the person's manager (never self-approval, LEV-04).
  const emp = store.data.employments.find((e) => e.personId === ctx.personId && e.clientId === ctx.clientId);
  let approver = emp?.managerPersonId ?? null;
  if (approver === ctx.personId) approver = null;
  const lv = {
    id: store.newId("lv"),
    clientId: ctx.clientId!,
    personId: ctx.personId,
    leaveType,
    startDate,
    endDate,
    partialDay: Boolean(partialDay),
    hours: partialDay ? Number(hours) || null : null,
    state: "awaiting_approval" as const,
    approverPersonId: approver,
    reason: reason ?? null,
    submittedAt: new Date().toISOString(),
    decidedByPersonId: null,
    decidedAt: null,
    decisionReason: null,
  };
  store.data.leave.push(lv);
  store.record(ctx.user.id, ctx.clientId!, "leave_submit", lv.id, `${leaveType} ${startDate}..${endDate}`);
  res.status(201).json({ ok: true, id: lv.id });
});

app.post("/api/leave/:id/decide", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  const lv = store.data.leave.find((l) => l.id === req.params.id && l.clientId === ctx.clientId);
  if (!lv) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Prevent self-approval (LEV-04) and enforce approver identity.
  if (lv.personId === ctx.personId) {
    res.status(403).json({ error: "You cannot approve your own leave" });
    return;
  }
  const isApprover = lv.approverPersonId === ctx.personId;
  const isAdmin = ctx.role === "client_admin";
  if (!isApprover && !isAdmin) {
    res.status(403).json({ error: "Only the nominated approver can decide" });
    return;
  }
  if (!roleCan(ctx.role!, "approve")) {
    res.status(403).json({ error: "Not permitted to approve" });
    return;
  }
  const { decision, reason } = req.body as { decision?: "approve" | "decline"; reason?: string };
  if (decision === "decline" && !reason) {
    res.status(400).json({ error: "A reason is required to decline" });
    return;
  }
  if (decision === "approve") lv.state = "approved";
  else if (decision === "decline") lv.state = "declined";
  else {
    res.status(400).json({ error: "decision must be approve or decline" });
    return;
  }
  lv.decidedByPersonId = ctx.personId;
  lv.decidedAt = new Date().toISOString();
  lv.decisionReason = reason ?? "Approved";
  store.record(ctx.user.id, ctx.clientId!, "leave_decide", lv.id, decision ?? "");
  res.json({ ok: true, state: lv.state });
});

// ---------------------------------------------------------------------------
// Reports (RPT)
// ---------------------------------------------------------------------------
app.get("/api/reports", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!canAccessModule(ctx, "reporting", false)) {
    res.status(403).json({ error: "Module unavailable" });
    return;
  }
  const scope = personIdsInScope(ctx);
  const asAt = new Date().toISOString();

  const employments = store.data.employments.filter((e) => e.clientId === ctx.clientId && scope.has(e.personId));
  const workforce = {
    activeAssignments: employments.filter((e) => e.status === "active").length,
    uniquePeople: new Set(employments.map((e) => e.personId)).size,
    byType: employments.reduce<Record<string, number>>((acc, e) => {
      acc[e.employmentType] = (acc[e.employmentType] ?? 0) + 1;
      return acc;
    }, {}),
  };

  const assignments = store.data.policyAssignments.filter((pa) => pa.clientId === ctx.clientId && scope.has(pa.personId));
  const policyResponses = {
    issued: assignments.length,
    acknowledged: assignments.filter((pa) => pa.state === "acknowledged").length,
    outstanding: assignments.filter((pa) => pa.state !== "acknowledged").length,
  };

  const reqs = store.data.credentialRequirements.filter((r) => r.clientId === ctx.clientId && scope.has(r.personId));
  const credentialGaps = { missing: 0, expired: 0, expiring: 0, pending: 0, current: 0 };
  for (const r of reqs) {
    const st = credentialStateFor(ctx.clientId!, r.personId, r.typeId);
    if (!st.verified && !st.pending) credentialGaps.missing += 1;
    else {
      if (st.validity === "expired") credentialGaps.expired += 1;
      else if (st.validity === "expiring") credentialGaps.expiring += 1;
      else if (st.validity === "current" || st.validity === "no_expiry") credentialGaps.current += 1;
      if (st.pending) credentialGaps.pending += 1;
    }
  }

  const leaveRows = store.data.leave.filter((l) => l.clientId === ctx.clientId && scope.has(l.personId));
  const leavePlanner = {
    approved: leaveRows.filter((l) => l.state === "approved").length,
    pending: leaveRows.filter((l) => l.state === "awaiting_approval").length,
  };

  res.json({
    asAt,
    scopePeople: scope.size,
    reports: {
      workforce: { definition: "Active employment assignments and unique people (not FTE).", data: workforce },
      policyResponses: { definition: "Acknowledged assignments over eligible issued assignments.", data: policyResponses },
      credentialGaps: { definition: "Requirements by validity; pending shown separately.", data: credentialGaps },
      leavePlanner: { definition: "Approved absence and pending requests (no inferred balances).", data: leavePlanner },
    },
  });
});

// ---------------------------------------------------------------------------
// Settings — module controls (CFG) + branding (BRD)
// ---------------------------------------------------------------------------
app.get("/api/settings", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!(ctx.role === "client_admin" || ctx.role === "consultant" || ctx.role === "platform_owner")) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const c = ctx.client!;
  res.json({
    client: { id: c.id, tradingName: c.tradingName, legalName: c.legalName, abn: c.abn, code: c.code, status: c.status, timezone: c.timezone },
    branding: c.branding,
    modules: c.modules,
    sites: store.data.sites.filter((s) => s.clientId === c.id).map((s) => ({ id: s.id, name: s.name, timezone: s.timezone })),
    teams: store.data.teams.filter((t) => t.clientId === c.id).map((t) => ({ id: t.id, name: t.name })),
  });
});

const CORE_ALWAYS_ON: ModuleKey[] = ["people"];

app.patch("/api/settings/modules", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!(ctx.role === "client_admin" || ctx.role === "consultant" || ctx.role === "platform_owner")) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const { module: key, state } = req.body as { module?: ModuleKey; state?: string };
  if (!key || !state || !(key in ctx.client!.modules)) {
    res.status(400).json({ error: "module and state required" });
    return;
  }
  if (CORE_ALWAYS_ON.includes(key)) {
    res.status(400).json({ error: "Core modules cannot be turned off" });
    return;
  }
  if (!["off", "configuring", "active", "read_only"].includes(state)) {
    res.status(400).json({ error: "invalid state" });
    return;
  }
  ctx.client!.modules[key] = state as never;
  store.record(ctx.user.id, ctx.clientId!, "module_state", key, state);
  res.json({ ok: true, modules: ctx.client!.modules });
});

const PALETTES: PaletteKey[] = ["purple_teal", "deep_teal_sage", "plum_stone", "charcoal_neutral"];

app.patch("/api/settings/branding", requireClient, (req: AuthedRequest, res) => {
  const ctx = req.ctx!;
  if (!(ctx.role === "client_admin" || ctx.role === "consultant" || ctx.role === "platform_owner")) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const { palette, displayName } = req.body as { palette?: PaletteKey; displayName?: string };
  if (palette && !PALETTES.includes(palette)) {
    res.status(400).json({ error: "Unknown palette" });
    return;
  }
  if (palette) ctx.client!.branding.palette = palette;
  if (displayName) ctx.client!.branding.displayName = displayName;
  store.record(ctx.user.id, ctx.clientId!, "branding", "client", ctx.client!.branding.palette);
  res.json({ ok: true, branding: ctx.client!.branding });
});

app.listen(PORT, () => {
  console.log(`DreamHR API listening on http://localhost:${PORT}`);
});
