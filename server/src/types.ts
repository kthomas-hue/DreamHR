// ---------------------------------------------------------------------------
// DreamHR domain model
// A multi-tenant HR platform: DreamStoneHR (provider) oversees isolated client
// workspaces; clients manage their people; employees complete HR tasks.
// ---------------------------------------------------------------------------

export type Role =
  | "platform_owner"
  | "consultant"
  | "client_admin"
  | "manager"
  | "employee"
  | "safety_officer"
  | "auditor";

export type ModuleKey =
  | "people"
  | "policies"
  | "credentials"
  | "leave"
  | "safety"
  | "lifecycle"
  | "reviews"
  | "reporting";

export type ModuleState = "off" | "configuring" | "active" | "read_only";

export type PaletteKey =
  | "purple_teal"
  | "deep_teal_sage"
  | "plum_stone"
  | "charcoal_neutral";

export type ClientStatus =
  | "draft"
  | "configuring"
  | "pilot"
  | "active"
  | "suspended"
  | "closing";

export interface Client {
  id: string;
  tradingName: string;
  legalName: string;
  abn: string;
  code: string;
  status: ClientStatus;
  timezone: string;
  branding: {
    palette: PaletteKey;
    displayName: string;
    logoText: string;
  };
  modules: Record<ModuleKey, ModuleState>;
  leadConsultantUserId: string | null;
  backupConsultantUserId: string | null;
}

export interface LegalEntity {
  id: string;
  clientId: string;
  name: string;
  abn: string;
}

export interface Site {
  id: string;
  clientId: string;
  name: string;
  timezone: string;
}

export interface Team {
  id: string;
  clientId: string;
  siteId: string;
  name: string;
}

// A single login identity. May hold multiple memberships across clients.
export interface User {
  id: string;
  email: string;
  password: string; // demo only — never store plaintext in production
  fullName: string;
  isDreamStone: boolean;
}

export type Scope =
  | { type: "all" }
  | { type: "site"; siteIds: string[] }
  | { type: "team"; teamIds: string[] }
  | { type: "self"; personId: string };

// Ties a user to a client with a role and organisational scope.
export interface Membership {
  id: string;
  userId: string;
  clientId: string;
  role: Role;
  scope: Scope;
  active: boolean;
  personId: string | null; // set for employee/manager memberships
}

// DreamStoneHR staff assignment to client workspaces.
export interface ConsultantAssignment {
  userId: string;
  clientId: string;
  relationship: "lead" | "backup" | "support";
}

export type EmploymentType = "permanent" | "fixed_term" | "casual" | "contractor";
export type EmploymentStatus = "active" | "archived";

export interface Remuneration {
  amount: number;
  basis: "annual" | "hourly";
  currency: string;
  superInclusive: boolean;
  effectiveDate: string;
  reason: string;
}

export interface Person {
  id: string;
  clientId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  workEmail: string;
  phone: string;
  location: string;
  emergencyContact: string | null;
}

export interface EmploymentAssignment {
  id: string;
  personId: string;
  clientId: string;
  entityId: string;
  siteId: string;
  teamId: string;
  managerPersonId: string | null;
  title: string;
  status: EmploymentStatus;
  employmentType: EmploymentType;
  startDate: string;
  endDate: string | null;
  ordinaryHours: number;
  fte: number;
  probationDate: string | null;
  remuneration: Remuneration; // restricted field group
}

export type DocumentCategory =
  | "employee_visible"
  | "manager_visible"
  | "restricted_hr";

export interface EmployeeDocument {
  id: string;
  clientId: string;
  personId: string;
  title: string;
  category: DocumentCategory;
  version: number;
  issueDate: string;
  retentionClass: string;
  released: boolean;
  fileName: string;
  hash: string;
}

export type PolicyVersionState =
  | "draft"
  | "approved"
  | "published"
  | "superseded"
  | "withdrawn";

export interface PolicyVersion {
  version: number;
  state: PolicyVersionState;
  publishedAt: string | null;
  hash: string;
  summary: string;
}

export interface Policy {
  id: string;
  clientId: string;
  title: string;
  category: string;
  owner: string;
  reviewDate: string;
  currentVersion: number;
  versions: PolicyVersion[];
}

export type PolicyAssignmentState =
  | "assigned"
  | "opened"
  | "acknowledged"
  | "declined"
  | "superseded"
  | "cancelled";

export interface PolicyAssignment {
  id: string;
  clientId: string;
  policyId: string;
  version: number;
  personId: string;
  dueDate: string;
  state: PolicyAssignmentState;
  assignedAt: string;
  openedAt: string | null;
}

// Immutable acknowledgement evidence.
export interface Acknowledgement {
  id: string;
  assignmentId: string;
  clientId: string;
  personId: string;
  statementText: string;
  timestampUtc: string;
  policyHash: string;
  version: number;
  sessionId: string;
}

export interface CredentialType {
  id: string;
  clientId: string;
  name: string;
  issuer: string;
  jurisdiction: string;
  renewalRequired: boolean;
  reviewerRole: Role;
}

// A required credential allocated to a person (distinct from evidence uploaded).
export interface CredentialRequirement {
  id: string;
  clientId: string;
  typeId: string;
  personId: string;
}

export type VerificationStatus = "unsubmitted" | "pending" | "verified" | "rejected";

export interface CredentialRecord {
  id: string;
  clientId: string;
  personId: string;
  typeId: string;
  number: string | null;
  issueDate: string | null;
  expiryDate: string | null; // null == no expiry
  evidenceFileName: string | null;
  verificationStatus: VerificationStatus;
  verifier: string | null;
  verificationDate: string | null;
  conditions: string | null;
  supersededBy: string | null;
}

export type LeaveType = "annual" | "personal" | "unpaid" | "compassionate" | "long_service";

export type LeaveState =
  | "draft"
  | "submitted"
  | "awaiting_approval"
  | "approved"
  | "declined"
  | "cancellation_requested"
  | "cancelled";

export interface LeaveRequest {
  id: string;
  clientId: string;
  personId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  partialDay: boolean;
  hours: number | null;
  state: LeaveState;
  approverPersonId: string | null;
  reason: string | null; // private — never shown to colleagues
  submittedAt: string | null;
  decidedByPersonId: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}

export interface AuditEvent {
  id: string;
  clientId: string | null;
  actorUserId: string;
  action: string;
  entity: string;
  timestampUtc: string;
  detail: string;
}

// Session token -> user + active client selection.
export interface Session {
  token: string;
  userId: string;
  activeClientId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Derived action-feed item (ACT-01: an action points to its source record).
// ---------------------------------------------------------------------------
export type ActionCategory =
  | "policy_ack"
  | "credential_renewal"
  | "credential_verify"
  | "leave_approval"
  | "leave_status";

export type ActionUrgency = "urgent" | "high" | "normal";

export interface ActionItem {
  id: string;
  clientId: string;
  category: ActionCategory;
  module: ModuleKey;
  subject: string; // what
  responsible: string; // who
  nextAction: string; // what happens next
  reason: string;
  dueDate: string | null;
  urgency: ActionUrgency;
  status: string;
  sourceId: string;
  sourcePath: string; // client-scoped link to the record
  personId: string | null;
}
