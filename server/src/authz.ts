import { store } from "./store.js";
import type {
  Client,
  EmploymentAssignment,
  LeaveRequest,
  Membership,
  ModuleKey,
  Person,
  Role,
  Session,
  User,
} from "./types.js";

export interface AuthContext {
  user: User;
  session: Session;
  isDreamStone: boolean;
  clientId: string | null;
  client: Client | null;
  membership: Membership | null;
  role: Role | null;
  personId: string | null;
}

// Clients a DreamStone staff member is assigned to (SEC-01: no unassigned clients).
export function portfolioClientIds(userId: string): string[] {
  return store.data.consultantAssignments
    .filter((a) => a.userId === userId)
    .map((a) => a.clientId);
}

// All clients a login can access (memberships for client users; assignments for staff).
export function accessibleClientIds(user: User): string[] {
  if (user.isDreamStone) return portfolioClientIds(user.id);
  return store.data.memberships
    .filter((m) => m.userId === user.id && m.active)
    .map((m) => m.clientId);
}

export function membershipFor(userId: string, clientId: string): Membership | undefined {
  return store.data.memberships.find(
    (m) => m.userId === userId && m.clientId === clientId && m.active,
  );
}

// Build the authorisation context for the active client (default deny).
export function buildContext(session: Session): AuthContext | null {
  const user = store.data.users.find((u) => u.id === session.userId);
  if (!user) return null;

  const base: AuthContext = {
    user,
    session,
    isDreamStone: user.isDreamStone,
    clientId: null,
    client: null,
    membership: null,
    role: null,
    personId: null,
  };

  const clientId = session.activeClientId;
  if (!clientId) return base;

  // Re-check access to the active client on every request (SEC-03).
  if (!accessibleClientIds(user).includes(clientId)) return base;

  const client = store.data.clients.find((c) => c.id === clientId) ?? null;
  base.client = client;
  base.clientId = clientId;

  if (user.isDreamStone) {
    const assignment = store.data.consultantAssignments.find(
      (a) => a.userId === user.id && a.clientId === clientId,
    );
    base.role = user.id === "u-owner" ? "platform_owner" : "consultant";
    // staff have no person record inside the client
    base.personId = null;
    void assignment;
  } else {
    const m = membershipFor(user.id, clientId);
    if (m) {
      base.membership = m;
      base.role = m.role;
      base.personId = m.personId;
    }
  }

  return base;
}

// ---------------------------------------------------------------------------
// Module entitlement (CFG-01..CFG-03)
// ---------------------------------------------------------------------------
export function moduleState(client: Client, key: ModuleKey) {
  return client.modules[key];
}

export function canAccessModule(ctx: AuthContext, key: ModuleKey, write: boolean): boolean {
  if (!ctx.client || !ctx.role) return false;
  const state = ctx.client.modules[key];
  const isAdminLike =
    ctx.role === "client_admin" || ctx.role === "consultant" || ctx.role === "platform_owner";
  switch (state) {
    case "active":
      return true;
    case "read_only":
      return !write;
    case "configuring":
      return isAdminLike && !write ? true : isAdminLike; // preview/config for admins only
    case "off":
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Scope resolution (SEC-01: assigned organisational scope)
// ---------------------------------------------------------------------------
export function personIdsInScope(ctx: AuthContext): Set<string> {
  const ids = new Set<string>();
  if (!ctx.clientId || !ctx.role) return ids;

  const peopleInClient = store.data.people.filter((p) => p.clientId === ctx.clientId);
  const empByPerson = new Map<string, EmploymentAssignment>();
  for (const e of store.data.employments) {
    if (e.clientId === ctx.clientId) empByPerson.set(e.personId, e);
  }

  if (
    ctx.role === "client_admin" ||
    ctx.role === "consultant" ||
    ctx.role === "platform_owner" ||
    ctx.role === "auditor" ||
    ctx.role === "safety_officer"
  ) {
    for (const p of peopleInClient) ids.add(p.id);
    return ids;
  }

  const scope = ctx.membership?.scope;
  if (ctx.role === "employee") {
    if (ctx.personId) ids.add(ctx.personId);
    return ids;
  }

  if (ctx.role === "manager" && scope) {
    if (ctx.personId) ids.add(ctx.personId);
    if (scope.type === "team") {
      for (const p of peopleInClient) {
        const e = empByPerson.get(p.id);
        if (e && scope.teamIds.includes(e.teamId)) ids.add(p.id);
      }
    } else if (scope.type === "site") {
      for (const p of peopleInClient) {
        const e = empByPerson.get(p.id);
        if (e && scope.siteIds.includes(e.siteId)) ids.add(p.id);
      }
    } else if (scope.type === "all") {
      for (const p of peopleInClient) ids.add(p.id);
    }
    // direct reports by manager link
    for (const p of peopleInClient) {
      const e = empByPerson.get(p.id);
      if (e && e.managerPersonId === ctx.personId) ids.add(p.id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Record sensitivity (SEC-02: view vs edit; salary/health restrictions)
// ---------------------------------------------------------------------------
export function canSeeRemuneration(ctx: AuthContext, person: Person): boolean {
  if (ctx.role === "client_admin") return true;
  if (ctx.role === "employee" && ctx.personId === person.id) return true;
  return false; // managers, consultants, owner, safety, auditor: no salary
}

export function canSeeRestrictedHrDocs(ctx: AuthContext): boolean {
  return ctx.role === "client_admin";
}

export function canSeeLeaveReason(ctx: AuthContext, leave: LeaveRequest): boolean {
  if (ctx.role === "client_admin") return true;
  if (ctx.personId && ctx.personId === leave.personId) return true; // own request
  if (ctx.personId && ctx.personId === leave.approverPersonId) return true; // the approver
  return false;
}

// Capability matrix (SEC-02): which verbs a role may perform.
const CAPABILITIES: Record<Role, Set<string>> = {
  platform_owner: new Set(["view", "create", "edit", "publish", "export"]),
  consultant: new Set(["view", "create", "edit", "approve", "publish", "export"]),
  client_admin: new Set(["view", "create", "edit", "approve", "publish", "export", "delete"]),
  manager: new Set(["view", "approve"]),
  employee: new Set(["view", "acknowledge", "create"]),
  safety_officer: new Set(["view", "create", "edit"]),
  auditor: new Set(["view"]),
};

export function roleCan(role: Role, action: string): boolean {
  return CAPABILITIES[role]?.has(action) ?? false;
}
