import type { PaletteKey } from "./theme/palettes";

export type Role =
  | "platform_owner"
  | "consultant"
  | "client_admin"
  | "manager"
  | "employee"
  | "safety_officer"
  | "auditor";

export type ModuleKey =
  | "people" | "policies" | "credentials" | "leave"
  | "safety" | "lifecycle" | "reviews" | "reporting";

export type ModuleState = "off" | "configuring" | "active" | "read_only";

export interface ClientSummary {
  id: string;
  tradingName: string;
  displayName: string;
  logoText: string;
  palette: PaletteKey;
  status: string;
  modules: Record<ModuleKey, ModuleState>;
}

export interface Me {
  user: { id: string; name: string; email: string; isDreamStone: boolean };
  activeClientId: string | null;
  role: Role | null;
  personId: string | null;
  clients: ClientSummary[];
  activeClient: ClientSummary | null;
}

export type ActionUrgency = "urgent" | "high" | "normal";
export interface ActionItem {
  id: string;
  category: string;
  module: ModuleKey;
  subject: string;
  responsible: string;
  nextAction: string;
  reason: string;
  dueDate: string | null;
  urgency: ActionUrgency;
  status: string;
  sourcePath: string;
  personId: string | null;
}

export interface HomePayload {
  role: Role;
  actions: ActionItem[];
  summary: { urgent: number; high: number; total: number };
  upcomingLeave: { personId: string; name: string; startDate: string; endDate: string }[];
  peopleInScope: number;
}

export interface PersonRow {
  id: string; name: string; firstName: string; lastName: string;
  title: string; team: string; site: string; status: string;
  employmentType: string; workEmail: string;
}

export type Validity = "no_expiry" | "not_yet_valid" | "current" | "expiring" | "expired" | "not_applicable";
export type Verification = "unsubmitted" | "pending" | "verified" | "rejected";

export interface CredentialRow {
  requirementId: string; typeId: string; type: string; issuer: string; jurisdiction: string;
  personId: string; personName: string; validity: Validity; verification: Verification;
  expiryDate: string | null; pendingRecordId: string | null; verifiedRecordId: string | null;
  isMine: boolean; canVerify: boolean;
}

export interface PolicyRow {
  id: string; policyId: string; title: string; category: string; version: number;
  personId: string; personName: string; dueDate: string; state: string; overdue: boolean;
  summary: string; hash: string; isMine: boolean;
}

export interface LeaveRow {
  id: string; personId: string; personName: string; leaveType: string;
  startDate: string; endDate: string; partialDay: boolean; hours: number | null;
  state: string; approver: string | null; reason: string | null; isMine: boolean; canDecide: boolean;
}
