import type {
  Acknowledgement,
  Client,
  ConsultantAssignment,
  CredentialRecord,
  CredentialRequirement,
  CredentialType,
  EmployeeDocument,
  EmploymentAssignment,
  LeaveRequest,
  LegalEntity,
  Membership,
  ModuleKey,
  ModuleState,
  Person,
  Policy,
  PolicyAssignment,
  Site,
  Team,
  User,
} from "./types.js";

export interface Dataset {
  clients: Client[];
  entities: LegalEntity[];
  sites: Site[];
  teams: Team[];
  users: User[];
  memberships: Membership[];
  consultantAssignments: ConsultantAssignment[];
  people: Person[];
  employments: EmploymentAssignment[];
  documents: EmployeeDocument[];
  policies: Policy[];
  policyAssignments: PolicyAssignment[];
  acknowledgements: Acknowledgement[];
  credentialTypes: CredentialType[];
  credentialRequirements: CredentialRequirement[];
  credentialRecords: CredentialRecord[];
  leave: LeaveRequest[];
}

const DAY = 86_400_000;
function iso(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
}
function isoTime(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY).toISOString();
}

const allActive = (): Record<ModuleKey, ModuleState> => ({
  people: "active",
  policies: "active",
  credentials: "active",
  leave: "active",
  safety: "active",
  lifecycle: "active",
  reviews: "active",
  reporting: "active",
});

export function buildDataset(): Dataset {
  // -- Clients -------------------------------------------------------------
  const clients: Client[] = [
    {
      id: "cl-northwind",
      tradingName: "Northwind Foods",
      legalName: "Northwind Foods Pty Ltd",
      abn: "51 824 753 556",
      code: "NWF",
      status: "active",
      timezone: "Australia/Sydney",
      branding: {
        palette: "purple_teal",
        displayName: "Northwind Foods",
        logoText: "NF",
      },
      modules: allActive(),
      leadConsultantUserId: "u-consultant",
      backupConsultantUserId: "u-owner",
    },
    {
      id: "cl-harbour",
      tradingName: "Harbour Point Care",
      legalName: "Harbour Point Care Services Ltd",
      abn: "72 336 118 402",
      code: "HPC",
      status: "pilot",
      timezone: "Australia/Perth",
      branding: {
        palette: "deep_teal_sage",
        displayName: "Harbour Point Care",
        logoText: "HP",
      },
      modules: { ...allActive(), reviews: "configuring", lifecycle: "configuring" },
      leadConsultantUserId: "u-consultant",
      backupConsultantUserId: null,
    },
  ];

  // -- Entities / sites / teams -------------------------------------------
  const entities: LegalEntity[] = [
    { id: "en-nwf", clientId: "cl-northwind", name: "Northwind Foods Pty Ltd", abn: "51 824 753 556" },
    { id: "en-hpc", clientId: "cl-harbour", name: "Harbour Point Care Services Ltd", abn: "72 336 118 402" },
  ];
  const sites: Site[] = [
    { id: "si-nwf-syd", clientId: "cl-northwind", name: "Sydney Distribution Centre", timezone: "Australia/Sydney" },
    { id: "si-nwf-mel", clientId: "cl-northwind", name: "Melbourne Plant", timezone: "Australia/Melbourne" },
    { id: "si-hpc-per", clientId: "cl-harbour", name: "Fremantle Residence", timezone: "Australia/Perth" },
  ];
  const teams: Team[] = [
    { id: "tm-nwf-ops", clientId: "cl-northwind", siteId: "si-nwf-syd", name: "Operations" },
    { id: "tm-nwf-log", clientId: "cl-northwind", siteId: "si-nwf-syd", name: "Logistics" },
    { id: "tm-nwf-prod", clientId: "cl-northwind", siteId: "si-nwf-mel", name: "Production" },
    { id: "tm-hpc-care", clientId: "cl-harbour", siteId: "si-hpc-per", name: "Care Team" },
  ];

  // -- Users (logins) ------------------------------------------------------
  const pw = "demo1234";
  const users: User[] = [
    { id: "u-owner", email: "owner@dreamstonehr.com.au", password: pw, fullName: "Robin Hayes", isDreamStone: true },
    { id: "u-consultant", email: "sam@dreamstonehr.com.au", password: pw, fullName: "Sam Delgado", isDreamStone: true },
    // Northwind
    { id: "u-nwf-admin", email: "alex@northwindfoods.com.au", password: pw, fullName: "Alex Morgan", isDreamStone: false },
    { id: "u-nwf-mgr", email: "jordan@northwindfoods.com.au", password: pw, fullName: "Jordan Blake", isDreamStone: false },
    { id: "u-nwf-emp", email: "taylor@northwindfoods.com.au", password: pw, fullName: "Taylor Nguyen", isDreamStone: false },
    // Harbour Point
    { id: "u-hpc-admin", email: "morgan@harbourpointcare.com.au", password: pw, fullName: "Morgan Reeve", isDreamStone: false },
    { id: "u-hpc-safety", email: "kai@harbourpointcare.com.au", password: pw, fullName: "Kai Fischer", isDreamStone: false },
  ];

  const consultantAssignments: ConsultantAssignment[] = [
    { userId: "u-consultant", clientId: "cl-northwind", relationship: "lead" },
    { userId: "u-consultant", clientId: "cl-harbour", relationship: "lead" },
    { userId: "u-owner", clientId: "cl-northwind", relationship: "backup" },
  ];

  // -- People + employment (Northwind) ------------------------------------
  const people: Person[] = [];
  const employments: EmploymentAssignment[] = [];

  function addPerson(
    p: Omit<Person, "workEmail"> & { workEmail?: string },
    emp: Omit<EmploymentAssignment, "id" | "personId" | "clientId">,
  ) {
    const person: Person = { workEmail: `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}@example.com`, ...p };
    people.push(person);
    employments.push({ id: `emp-${p.id}`, personId: p.id, clientId: p.clientId, ...emp });
  }

  // Northwind managers/leads
  addPerson(
    { id: "pe-nwf-alex", clientId: "cl-northwind", firstName: "Alex", lastName: "Morgan", preferredName: null, workEmail: "alex@northwindfoods.com.au", phone: "0400 111 222", location: "Sydney, NSW", emergencyContact: "—" },
    { entityId: "en-nwf", siteId: "si-nwf-syd", teamId: "tm-nwf-ops", managerPersonId: null, title: "People & Culture Lead", status: "active", employmentType: "permanent", startDate: "2019-03-04", endDate: null, ordinaryHours: 38, fte: 1, probationDate: null, remuneration: { amount: 168000, basis: "annual", currency: "AUD", superInclusive: false, effectiveDate: "2024-07-01", reason: "Annual review" } },
  );
  addPerson(
    { id: "pe-nwf-jordan", clientId: "cl-northwind", firstName: "Jordan", lastName: "Blake", preferredName: null, workEmail: "jordan@northwindfoods.com.au", phone: "0400 333 444", location: "Sydney, NSW", emergencyContact: "—" },
    { entityId: "en-nwf", siteId: "si-nwf-syd", teamId: "tm-nwf-log", managerPersonId: "pe-nwf-alex", title: "Logistics Manager", status: "active", employmentType: "permanent", startDate: "2020-08-17", endDate: null, ordinaryHours: 38, fte: 1, probationDate: null, remuneration: { amount: 142000, basis: "annual", currency: "AUD", superInclusive: false, effectiveDate: "2024-07-01", reason: "Annual review" } },
  );
  addPerson(
    { id: "pe-nwf-taylor", clientId: "cl-northwind", firstName: "Taylor", lastName: "Nguyen", preferredName: null, workEmail: "taylor@northwindfoods.com.au", phone: "0400 555 666", location: "Sydney, NSW", emergencyContact: "Lee Nguyen — 0400 999 000" },
    { entityId: "en-nwf", siteId: "si-nwf-syd", teamId: "tm-nwf-log", managerPersonId: "pe-nwf-jordan", title: "Forklift Operator", status: "active", employmentType: "permanent", startDate: "2022-02-14", endDate: null, ordinaryHours: 38, fte: 1, probationDate: null, remuneration: { amount: 74000, basis: "annual", currency: "AUD", superInclusive: false, effectiveDate: "2024-07-01", reason: "EBA increase" } },
  );
  addPerson(
    { id: "pe-nwf-sam2", clientId: "cl-northwind", firstName: "Priya", lastName: "Nair", preferredName: null, workEmail: "priya@northwindfoods.com.au", phone: "0400 777 888", location: "Sydney, NSW", emergencyContact: "—" },
    { entityId: "en-nwf", siteId: "si-nwf-syd", teamId: "tm-nwf-log", managerPersonId: "pe-nwf-jordan", title: "Warehouse Coordinator", status: "active", employmentType: "permanent", startDate: "2021-11-01", endDate: null, ordinaryHours: 38, fte: 1, probationDate: null, remuneration: { amount: 82000, basis: "annual", currency: "AUD", superInclusive: false, effectiveDate: "2024-07-01", reason: "Annual review" } },
  );
  addPerson(
    { id: "pe-nwf-diego", clientId: "cl-northwind", firstName: "Diego", lastName: "Martinez", preferredName: null, workEmail: "diego@northwindfoods.com.au", phone: "0400 121 212", location: "Melbourne, VIC", emergencyContact: "—" },
    { entityId: "en-nwf", siteId: "si-nwf-mel", teamId: "tm-nwf-prod", managerPersonId: "pe-nwf-alex", title: "Production Supervisor", status: "active", employmentType: "permanent", startDate: "2023-06-19", endDate: null, ordinaryHours: 38, fte: 1, probationDate: iso(20), remuneration: { amount: 96000, basis: "annual", currency: "AUD", superInclusive: false, effectiveDate: "2024-07-01", reason: "New hire" } },
  );
  addPerson(
    { id: "pe-nwf-emma", clientId: "cl-northwind", firstName: "Emma", lastName: "Johansson", preferredName: null, workEmail: "emma@northwindfoods.com.au", phone: "0400 343 434", location: "Melbourne, VIC", emergencyContact: "—" },
    { entityId: "en-nwf", siteId: "si-nwf-mel", teamId: "tm-nwf-prod", managerPersonId: "pe-nwf-diego", title: "Machine Operator", status: "active", employmentType: "casual", startDate: "2024-01-22", endDate: null, ordinaryHours: 20, fte: 0.5, probationDate: null, remuneration: { amount: 41.5, basis: "hourly", currency: "AUD", superInclusive: false, effectiveDate: "2024-07-01", reason: "Casual rate" } },
  );

  // Harbour Point people
  addPerson(
    { id: "pe-hpc-morgan", clientId: "cl-harbour", firstName: "Morgan", lastName: "Reeve", preferredName: null, workEmail: "morgan@harbourpointcare.com.au", phone: "0400 565 656", location: "Fremantle, WA", emergencyContact: "—" },
    { entityId: "en-hpc", siteId: "si-hpc-per", teamId: "tm-hpc-care", managerPersonId: null, title: "Facility Manager", status: "active", employmentType: "permanent", startDate: "2018-05-02", endDate: null, ordinaryHours: 38, fte: 1, probationDate: null, remuneration: { amount: 138000, basis: "annual", currency: "AUD", superInclusive: false, effectiveDate: "2024-07-01", reason: "Annual review" } },
  );
  addPerson(
    { id: "pe-hpc-noah", clientId: "cl-harbour", firstName: "Noah", lastName: "Williams", preferredName: null, workEmail: "noah@harbourpointcare.com.au", phone: "0400 787 878", location: "Fremantle, WA", emergencyContact: "—" },
    { entityId: "en-hpc", siteId: "si-hpc-per", teamId: "tm-hpc-care", managerPersonId: "pe-hpc-morgan", title: "Registered Nurse", status: "active", employmentType: "permanent", startDate: "2021-09-13", endDate: null, ordinaryHours: 38, fte: 1, probationDate: null, remuneration: { amount: 98000, basis: "annual", currency: "AUD", superInclusive: false, effectiveDate: "2024-07-01", reason: "Annual review" } },
  );

  // -- Memberships (link logins to clients + person records) ---------------
  const memberships: Membership[] = [
    { id: "m-nwf-admin", userId: "u-nwf-admin", clientId: "cl-northwind", role: "client_admin", scope: { type: "all" }, active: true, personId: "pe-nwf-alex" },
    { id: "m-nwf-mgr", userId: "u-nwf-mgr", clientId: "cl-northwind", role: "manager", scope: { type: "team", teamIds: ["tm-nwf-log"] }, active: true, personId: "pe-nwf-jordan" },
    { id: "m-nwf-emp", userId: "u-nwf-emp", clientId: "cl-northwind", role: "employee", scope: { type: "self", personId: "pe-nwf-taylor" }, active: true, personId: "pe-nwf-taylor" },
    { id: "m-hpc-admin", userId: "u-hpc-admin", clientId: "cl-harbour", role: "client_admin", scope: { type: "all" }, active: true, personId: "pe-hpc-morgan" },
    { id: "m-hpc-safety", userId: "u-hpc-safety", clientId: "cl-harbour", role: "safety_officer", scope: { type: "all" }, active: true, personId: null },
  ];

  // -- Documents -----------------------------------------------------------
  const documents: EmployeeDocument[] = [
    { id: "doc-1", clientId: "cl-northwind", personId: "pe-nwf-taylor", title: "Employment Contract", category: "employee_visible", version: 1, issueDate: "2022-02-10", retentionClass: "employment-7yr", released: true, fileName: "contract.pdf", hash: "a1b2c3" },
    { id: "doc-2", clientId: "cl-northwind", personId: "pe-nwf-taylor", title: "Position Description — Forklift Operator", category: "employee_visible", version: 2, issueDate: "2023-07-01", retentionClass: "employment-7yr", released: true, fileName: "pd.pdf", hash: "d4e5f6" },
    { id: "doc-3", clientId: "cl-northwind", personId: "pe-nwf-taylor", title: "HR case note", category: "restricted_hr", version: 1, issueDate: "2024-03-11", retentionClass: "restricted", released: false, fileName: "note.pdf", hash: "99aa88" },
  ];

  // -- Policies ------------------------------------------------------------
  const policies: Policy[] = [
    {
      id: "pol-whs", clientId: "cl-northwind", title: "Work Health & Safety Policy", category: "Safety", owner: "Alex Morgan", reviewDate: iso(120), currentVersion: 2,
      versions: [
        { version: 1, state: "superseded", publishedAt: isoTime(-400), hash: "whs-v1-7f3a", summary: "Initial WHS policy." },
        { version: 2, state: "published", publishedAt: isoTime(-30), hash: "whs-v2-c81d", summary: "Updated hazard reporting and PPE requirements." },
      ],
    },
    {
      id: "pol-coc", clientId: "cl-northwind", title: "Code of Conduct", category: "Conduct", owner: "Alex Morgan", reviewDate: iso(200), currentVersion: 1,
      versions: [{ version: 1, state: "published", publishedAt: isoTime(-90), hash: "coc-v1-4b2e", summary: "Expected standards of behaviour." }],
    },
    {
      id: "pol-privacy", clientId: "cl-harbour", title: "Privacy & Records Policy", category: "Privacy", owner: "Morgan Reeve", reviewDate: iso(60), currentVersion: 1,
      versions: [{ version: 1, state: "published", publishedAt: isoTime(-45), hash: "priv-v1-1a9c", summary: "Handling of resident and staff records." }],
    },
  ];

  const policyAssignments: PolicyAssignment[] = [
    // Taylor: WHS overdue, CoC due soon
    { id: "pa-1", clientId: "cl-northwind", policyId: "pol-whs", version: 2, personId: "pe-nwf-taylor", dueDate: iso(-3), state: "assigned", assignedAt: isoTime(-14), openedAt: null },
    { id: "pa-2", clientId: "cl-northwind", policyId: "pol-coc", version: 1, personId: "pe-nwf-taylor", dueDate: iso(5), state: "opened", assignedAt: isoTime(-10), openedAt: isoTime(-2) },
    // Priya: WHS acknowledged already
    { id: "pa-3", clientId: "cl-northwind", policyId: "pol-whs", version: 2, personId: "pe-nwf-sam2", dueDate: iso(4), state: "acknowledged", assignedAt: isoTime(-14), openedAt: isoTime(-12) },
    // Diego: WHS due soon
    { id: "pa-4", clientId: "cl-northwind", policyId: "pol-whs", version: 2, personId: "pe-nwf-diego", dueDate: iso(2), state: "assigned", assignedAt: isoTime(-14), openedAt: null },
    // Harbour: Noah privacy overdue
    { id: "pa-5", clientId: "cl-harbour", policyId: "pol-privacy", version: 1, personId: "pe-hpc-noah", dueDate: iso(-1), state: "assigned", assignedAt: isoTime(-20), openedAt: null },
  ];

  const acknowledgements: Acknowledgement[] = [
    { id: "ack-1", assignmentId: "pa-3", clientId: "cl-northwind", personId: "pe-nwf-sam2", statementText: "I have read and understood this policy.", timestampUtc: isoTime(-11), policyHash: "whs-v2-c81d", version: 2, sessionId: "seed-session" },
  ];

  // -- Credentials ---------------------------------------------------------
  const credentialTypes: CredentialType[] = [
    { id: "ct-forklift", clientId: "cl-northwind", name: "Forklift Licence (LF)", issuer: "SafeWork NSW", jurisdiction: "NSW", renewalRequired: true, reviewerRole: "client_admin" },
    { id: "ct-firstaid", clientId: "cl-northwind", name: "First Aid Certificate", issuer: "St John Ambulance", jurisdiction: "AU", renewalRequired: true, reviewerRole: "manager" },
    { id: "ct-ahpra", clientId: "cl-harbour", name: "AHPRA Nursing Registration", issuer: "AHPRA", jurisdiction: "AU", renewalRequired: true, reviewerRole: "client_admin" },
    { id: "ct-police", clientId: "cl-harbour", name: "National Police Check", issuer: "ACIC", jurisdiction: "AU", renewalRequired: true, reviewerRole: "client_admin" },
  ];
  const credentialRequirements: CredentialRequirement[] = [
    { id: "cr-1", clientId: "cl-northwind", typeId: "ct-forklift", personId: "pe-nwf-taylor" },
    { id: "cr-2", clientId: "cl-northwind", typeId: "ct-firstaid", personId: "pe-nwf-taylor" },
    { id: "cr-3", clientId: "cl-northwind", typeId: "ct-forklift", personId: "pe-nwf-emma" },
    { id: "cr-4", clientId: "cl-harbour", typeId: "ct-ahpra", personId: "pe-hpc-noah" },
    { id: "cr-5", clientId: "cl-harbour", typeId: "ct-police", personId: "pe-hpc-noah" },
  ];
  const credentialRecords: CredentialRecord[] = [
    // Taylor forklift: expiring in 12 days, verified
    { id: "cd-1", clientId: "cl-northwind", personId: "pe-nwf-taylor", typeId: "ct-forklift", number: "LF-88213", issueDate: "2023-09-01", expiryDate: iso(12), evidenceFileName: "forklift.pdf", verificationStatus: "verified", verifier: "Alex Morgan", verificationDate: iso(-360), conditions: null, supersededBy: null },
    // Taylor first aid: EXPIRED 5 days ago, verified (so a renewal is needed)
    { id: "cd-2", clientId: "cl-northwind", personId: "pe-nwf-taylor", typeId: "ct-firstaid", number: "FA-4521", issueDate: "2023-06-01", expiryDate: iso(-5), evidenceFileName: "firstaid.pdf", verificationStatus: "verified", verifier: "Jordan Blake", verificationDate: iso(-100), conditions: null, supersededBy: null },
    // Emma forklift: requirement unfilled (no record) -> gap
    // Noah AHPRA: current, pending verification of a renewal
    { id: "cd-3", clientId: "cl-harbour", personId: "pe-hpc-noah", typeId: "ct-ahpra", number: "NMW0001234567", issueDate: "2025-06-01", expiryDate: iso(40), evidenceFileName: "ahpra.pdf", verificationStatus: "pending", verifier: null, verificationDate: null, conditions: null, supersededBy: null },
    // Noah police check: expired 2 days ago
    { id: "cd-4", clientId: "cl-harbour", personId: "pe-hpc-noah", typeId: "ct-police", number: "PC-99120", issueDate: "2023-08-01", expiryDate: iso(-2), evidenceFileName: "police.pdf", verificationStatus: "verified", verifier: "Morgan Reeve", verificationDate: iso(-200), conditions: null, supersededBy: null },
  ];

  // -- Leave ---------------------------------------------------------------
  const leave: LeaveRequest[] = [
    // Taylor annual leave awaiting Jordan's approval
    { id: "lv-1", clientId: "cl-northwind", personId: "pe-nwf-taylor", leaveType: "annual", startDate: iso(14), endDate: iso(18), partialDay: false, hours: null, state: "awaiting_approval", approverPersonId: "pe-nwf-jordan", reason: "Family holiday", submittedAt: isoTime(-1), decidedByPersonId: null, decidedAt: null, decisionReason: null },
    // Priya annual leave overlapping — awaiting approval (overlap warning)
    { id: "lv-2", clientId: "cl-northwind", personId: "pe-nwf-sam2", leaveType: "annual", startDate: iso(15), endDate: iso(16), partialDay: false, hours: null, state: "awaiting_approval", approverPersonId: "pe-nwf-jordan", reason: "Personal", submittedAt: isoTime(-1), decidedByPersonId: null, decidedAt: null, decisionReason: null },
    // Taylor prior approved leave
    { id: "lv-3", clientId: "cl-northwind", personId: "pe-nwf-taylor", leaveType: "personal", startDate: iso(-20), endDate: iso(-20), partialDay: true, hours: 4, state: "approved", approverPersonId: "pe-nwf-jordan", reason: "Medical appointment", submittedAt: isoTime(-25), decidedByPersonId: "pe-nwf-jordan", decidedAt: isoTime(-24), decisionReason: "Approved" },
    // Diego annual leave awaiting approval by Alex
    { id: "lv-4", clientId: "cl-northwind", personId: "pe-nwf-diego", leaveType: "annual", startDate: iso(30), endDate: iso(34), partialDay: false, hours: null, state: "awaiting_approval", approverPersonId: "pe-nwf-alex", reason: "Break", submittedAt: isoTime(-2), decidedByPersonId: null, decidedAt: null, decisionReason: null },
  ];

  return {
    clients, entities, sites, teams, users, memberships, consultantAssignments,
    people, employments, documents, policies, policyAssignments, acknowledgements,
    credentialTypes, credentialRequirements, credentialRecords, leave,
  };
}
