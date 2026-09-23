import type {
  ActionItem, ClientSummary, CredentialRow, HomePayload, LeaveRow, Me, PersonRow, PolicyRow,
} from "./types";

const BASE = "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  if (res.status === 401) throw new ApiError("Not authenticated", 401);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const api = {
  login: (email: string, password: string) =>
    req<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => req<Me>("/auth/me"),
  switchClient: (clientId: string | null) =>
    req<{ ok: true; activeClient: ClientSummary | null }>("/auth/switch-client", {
      method: "POST", body: JSON.stringify({ clientId }),
    }),

  portfolio: () => req<PortfolioPayload>("/portfolio"),
  home: () => req<HomePayload>("/home"),
  actions: () => req<ActionItem[]>("/actions"),

  people: () => req<PersonRow[]>("/people"),
  person: (id: string) => req<PersonDetail>(`/people/${id}`),

  policies: () => req<PolicyRow[]>("/policies"),
  openPolicy: (assignmentId: string) =>
    req<{ ok: true; state: string }>(`/policies/${assignmentId}/open`, { method: "POST" }),
  acknowledge: (assignmentId: string, statement: string) =>
    req<{ ok: true; acknowledgement?: AckEvidence; alreadyAcknowledged?: boolean }>(
      `/policies/${assignmentId}/acknowledge`,
      { method: "POST", body: JSON.stringify({ statement }) },
    ),
  policyEvidence: (policyId: string) => req<EvidenceBundle>(`/policies/${policyId}/evidence`),

  credentials: () => req<CredentialRow[]>("/credentials"),
  renewCredential: (requirementId: string, expiryDate: string, number?: string) =>
    req<{ ok: true }>("/credentials/renew", {
      method: "POST", body: JSON.stringify({ requirementId, expiryDate, number }),
    }),
  verifyCredential: (recordId: string, decision: "verify" | "reject", reason?: string) =>
    req<{ ok: true }>(`/credentials/${recordId}/verify`, {
      method: "POST", body: JSON.stringify({ decision, reason }),
    }),

  leave: () => req<LeaveRow[]>("/leave"),
  availability: () => req<AvailabilityEntry[]>("/leave/availability"),
  requestLeave: (payload: LeaveRequestInput) =>
    req<{ ok: true; id: string }>("/leave", { method: "POST", body: JSON.stringify(payload) }),
  decideLeave: (id: string, decision: "approve" | "decline", reason?: string) =>
    req<{ ok: true; state: string }>(`/leave/${id}/decide`, {
      method: "POST", body: JSON.stringify({ decision, reason }),
    }),

  reports: () => req<ReportsPayload>("/reports"),

  settings: () => req<SettingsPayload>("/settings"),
  setModule: (module: string, state: string) =>
    req<{ ok: true; modules: Record<string, string> }>("/settings/modules", {
      method: "PATCH", body: JSON.stringify({ module, state }),
    }),
  setBranding: (palette?: string, displayName?: string) =>
    req<{ ok: true; branding: { palette: string; displayName: string; logoText: string } }>(
      "/settings/branding",
      { method: "PATCH", body: JSON.stringify({ palette, displayName }) },
    ),
};

// ---- response shapes only used here ----
export interface PortfolioPayload {
  clients: (ClientSummary & {
    legalName: string; timezone: string;
    counts: { urgent: number; high: number; total: number; people: number };
    topActions: ActionItem[];
  })[];
  totals: { urgent: number; high: number; clients: number };
  stream: ActionItem[];
}

export interface PersonDetail {
  id: string; name: string; preferredName: string | null; workEmail: string; phone: string;
  location: string; emergencyContact: string | null;
  employment: {
    title: string; entity: string; site: string; team: string; manager: string | null;
    status: string; employmentType: string; startDate: string; endDate: string | null;
    ordinaryHours: number; fte: number; probationDate: string | null;
  };
  remuneration: { amount: number; basis: string; currency: string; superInclusive: boolean; effectiveDate: string } | null;
  documents: { id: string; title: string; category: string; version: number; issueDate: string; released: boolean }[];
  policies: { id: string; title: string; version: number; state: string; dueDate: string }[];
  credentials: { type: string; validity: string; verification: string; expiryDate: string | null }[];
  leave: { id: string; leaveType: string; startDate: string; endDate: string; state: string; reason: string | null }[];
}

export interface AckEvidence {
  id: string; statementText: string; timestampUtc: string; policyHash: string; version: number; sessionId: string;
}
export interface EvidenceBundle {
  policy: { title: string; category: string; currentVersion: number };
  asAt: string; acknowledged: number; outstanding: number;
  population: { person: string; version: number; state: string; dueDate: string; acknowledgedAt: string | null; statement: string | null; policyHash: string | null }[];
}
export interface AvailabilityEntry { personId: string; name: string; startDate: string; endDate: string; label: string; pending: boolean; }
export interface LeaveRequestInput { leaveType: string; startDate: string; endDate: string; partialDay: boolean; hours?: number; reason?: string; }
export interface ReportsPayload {
  asAt: string; scopePeople: number;
  reports: {
    workforce: { definition: string; data: { activeAssignments: number; uniquePeople: number; byType: Record<string, number> } };
    policyResponses: { definition: string; data: { issued: number; acknowledged: number; outstanding: number } };
    credentialGaps: { definition: string; data: { missing: number; expired: number; expiring: number; pending: number; current: number } };
    leavePlanner: { definition: string; data: { approved: number; pending: number } };
  };
}
export interface SettingsPayload {
  client: { id: string; tradingName: string; legalName: string; abn: string; code: string; status: string; timezone: string };
  branding: { palette: string; displayName: string; logoText: string };
  modules: Record<string, string>;
  sites: { id: string; name: string; timezone: string }[];
  teams: { id: string; name: string }[];
}
