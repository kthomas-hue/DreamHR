# DreamHR

DreamHR is DreamStoneHR's client-facing HR platform: one secure web workspace where
DreamStoneHR oversees each client, client administrators and managers run their people
processes, and employees complete everyday HR tasks. Every screen is built around a
single question set — **what needs attention, who is responsible, and what happens next.**

This repository contains a working **Release-1 foundation** implementing the multi-tenant
model, server-side authorisation, and the defining cross-role experience, built to the
DreamHR development specification. See [Scope in this build](#scope-in-this-build).

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite + React Router, with a bespoke design system (CSS design tokens, four branding palettes)
- **Backend:** Node.js + Express (TypeScript, ESM), cookie session auth, server-side authorisation on every request
- **Storage:** in-memory seeded store (no external database required for the demo)
- **Tooling:** npm workspaces, `concurrently`, ESLint

## Getting started

Requires Node.js >= 20.

```bash
npm install     # install all workspace dependencies
npm run dev     # API (:3001) + web app (:5173)
```

Open http://localhost:5173 and sign in with a demo account (password `demo1234`):

| Account | Role | Sees |
| --- | --- | --- |
| `sam@dreamstonehr.com.au` | DreamStoneHR consultant | Cross-client portfolio queue for 2 assigned clients |
| `alex@northwindfoods.com.au` | Client administrator | All of Northwind Foods |
| `jordan@northwindfoods.com.au` | Manager | Northwind Logistics team only (no salary) |
| `taylor@northwindfoods.com.au` | Employee | Own tasks, policies, credentials, leave |
| `morgan@harbourpointcare.com.au` | Client administrator | All of Harbour Point Care |

## What's implemented

- **Multi-tenancy & isolation (SEC/ARC):** every record is client-scoped; access is re-checked on each request; cross-tenant IDs return 404; no client data leaks across workspaces.
- **Identity, roles & scope (SEC-01…SEC-04):** authorisation combines client membership, role, organisational scope, module entitlement and record sensitivity, defaulting to no access. Managers can't see salary; consultants can't see remuneration or restricted HR notes; employees see only their own records. One login can hold multiple memberships with an explicit client switch.
- **DreamStoneHR portfolio (ADM-01):** cross-client operating queue by urgency; never includes unassigned clients.
- **Role-aware home (UX-01):** employees lead with "Your next steps"; clients/managers with "Needs your attention"; a prioritised action stream instead of a wall of charts.
- **Shared action service (ACT-01):** every action points to its source record (policy, credential, leave).
- **People & profiles (PEO/DOC):** permission-aware directory; profile with employment, documents (category-gated), policies, credentials and leave.
- **Policies (POL):** assignment + acknowledgement journey recording immutable evidence (statement, UTC timestamp, version hash, session); receipt/understanding is distinguished from agreement; one acknowledgement per confirmation; exportable evidence bundle.
- **Credentials (CRE):** catalogue, requirements vs evidence, separate validity (current/expiring/expired/…) and verification (unsubmitted/pending/verified) indicators; renewal keeps prior evidence visible until verified.
- **Leave (LEV):** request, manager approval (no self-approval, routed to the nominated approver), and a privacy-safe availability calendar showing only "Away" with overlap warnings.
- **Reports (RPT):** workforce, policy responses, credential gaps and leave — each with definition, scope and as-at date.
- **Module controls & branding (CFG/BRD):** per-client module states (active/configuring/read-only/off) that gate navigation and APIs, and four accessible branding palettes applied live.

## Scope in this build

This is a Release-1-oriented vertical slice, not the complete multi-release product. Not yet
implemented (and called out in the specification as later releases): onboarding/offboarding
workflows, safety incidents/hazards, reviews/goals, the client setup wizard, file upload with
malware scanning, notifications/email, MFA, a relational database with retention/legal holds,
integrations (payroll/SSO/e-signature) and independent security testing. Data is seeded
in-memory and resets on restart (`POST /api/dev/reset` reseeds).

## Project layout

```
client/    # React + Vite frontend (design system, pages)
server/    # Express API (auth, authorisation, domain routes)
```
