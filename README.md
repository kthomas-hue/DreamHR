# DreamHR

A modern HR employee-management application. DreamHR provides a people-operations
dashboard and an employee directory with search, filtering, and record management.

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Node.js + Express (TypeScript, ESM)
- **Storage:** JSON file store (seeded on first run), no external database required
- **Tooling:** npm workspaces, `concurrently`, ESLint

## Project layout

```
.
├── client/          # Vite + React frontend (port 5173)
├── server/          # Express REST API (port 3001)
├── package.json     # npm workspaces + orchestration scripts
└── .cursor/         # Cloud Agent environment configuration
```

## Getting started

Requires Node.js >= 20.

```bash
npm install        # install all workspace dependencies
npm run dev        # start API (:3001) and web app (:5173) together
```

Then open http://localhost:5173.

### Other scripts

```bash
npm run dev:server   # run only the API in watch mode
npm run dev:client   # run only the frontend dev server
npm run build        # type-check + build both workspaces
npm run typecheck    # type-check both workspaces
npm run lint         # lint the frontend
```

## API

The Express API is served under `/api` (proxied by Vite in development):

| Method | Path                 | Description                     |
| ------ | -------------------- | ------------------------------- |
| GET    | `/api/health`        | Service health check            |
| GET    | `/api/stats`         | Aggregate headcount statistics  |
| GET    | `/api/employees`     | List all employees              |
| GET    | `/api/employees/:id` | Fetch a single employee         |
| POST   | `/api/employees`     | Create an employee              |
| PATCH  | `/api/employees/:id` | Update an employee              |
| DELETE | `/api/employees/:id` | Remove an employee              |
