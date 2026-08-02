<div align="center">

# ForgeFlow WMS

**An enterprise-grade Warehouse Management System (WMS) for real-world inventory operations, stock ledgers, and warehouse analytics.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?style=flat-square&logo=hono&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Cloudflare D1](https://img.shields.io/badge/Cloudflare%20D1-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black)
![Better Auth](https://img.shields.io/badge/Better%20Auth-4F46E5?style=flat-square&logo=auth0&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?style=flat-square&logo=pnpm&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-22B8CF?style=flat-square&logo=recharts&logoColor=white)

</div>

---

## Overview

ForgeFlow WMS is a full-stack **B2B / enterprise software showcase** that demonstrates production-grade thinking applied to a domain where correctness is non-negotiable: warehouse inventory management.

Built as a **monorepo** (PNPM workspaces) spanning a React frontend, a serverless edge API, a shared typed-contract layer, and a versioned database schema, the project is designed to be read like a real corporate system rather than a toy demo. Every stock transaction is written to an **immutable ledger**, every movement mutates stock balances in **atomic D1 batches**, and business workflows such as inbound receiving, quality inspection, PO over-receipt handling, and job material allocation are modeled end-to-end with explicit state machines.

The UI follows a dense, flat **"industrial" design language** tuned for operators who work with large datasets on screen all day — no consumer SaaS fluff, no gratuitous rounded corners or drop shadows.

---

## Key Features

### Immutable Stock Movement Ledger
Every change to inventory — receives, issues, adjustments, transfers, scrap returns, and corrections — is recorded as an append-only row in the `stock_movement` table with a signed `qtyDelta`, a movement type, a reference type/id back to the originating document, the acting staff member, and a timestamp. A parallel `stock_balance` projection maintains on-hand / allocated / available quantities. Both are updated in a **single D1 batch**, so the ledger and the balance can never drift apart.

### Inbound Receiving with Over-Receipt Handling
Full receiving workflow: create a draft receipt against a purchase order, inspect each line (accept / reject with discrepancy codes and quality inspection records), then post. Posting is transactional — accepted quantities become `receive` movements atomically. If received quantity exceeds the ordered quantity, a **PO over-receipt warning notification** is raised automatically, and purchase order lines transition through `partially_received → received`. A batch-post endpoint processes many receipts in one atomic batch with in-memory balance projections to guard against double-counting.

### Job Allocation & Material Issuing
Manufacturing jobs carry BOM lines. The allocation engine **previews availability** (recommends the best source location by available quantity and flags shortages), then issues material via atomic `issue` movements that decrement the chosen stock balance while recording the movement, the `job_issue`, and the BOM line's progressive `issuedQty`. Insufficient stock is rejected mid-transaction with a `INSUFFICIENT_STOCK` conflict; hitting zero on-hand triggers an automatic **stock-shortage notification**. Scrap returns post back to stock with a documented reason code.

### Master Data Management
Full CRUD for warehouses, zones, locations (with capacity and status enforcement), items / SKUs (UOM, category, lot/expiry/serial tracking flags, reorder points), staff profiles, and suppliers — all with server-side Zod validation, pagination, search, and role-gated write access.

### Dashboard & Analytics (Recharts)
Operations dashboard powered by dedicated aggregate endpoints: KPI cards (active SKUs, total on-hand, low-stock counts, open POs, open jobs, unread notifications), warehouse capacity utilization, inventory summaries, and a 7-day inbound/outbound movement trend rendered with **Recharts**.

### Role-Based Access Control (RBAC)
Four roles — `admin`, `manager`, `operator`, `auditor` — enforced by server-side middleware (`requireRole` / `requireWriteRole`). Auditors are **read-only by design**: every write endpoint rejects them with `403`. Client-side route guards mirror the same rules, but authorization always happens on the API.

### Idempotency & Notifications
Mutating endpoints accept an `Idempotency-Key` header (persisted in a dedicated table) to make retries safe, and an in-app notification system (`system`, `po_discrepancy`, `stock_shortage`) keeps operators informed of anomalies in real time.

---

## Tech Stack

| Layer        | Technology                                                     |
|--------------|----------------------------------------------------------------|
| Frontend     | React 18, Vite 5, TypeScript, Tailwind CSS 4, Radix UI, shadcn-style primitives |
| State/Data   | TanStack Query, Zustand, React Hook Form, Zod, Recharts        |
| API          | Hono 4 (Cloudflare Worker), Better Auth 1.x, `@hono/zod-validator` |
| Database     | Cloudflare D1 (SQLite), Drizzle ORM + Drizzle Kit migrations   |
| Auth         | Better Auth (email/password, Drizzle adapter)                  |
| Shared types | `@forgeflow/contracts` (Zod schemas + inferred TS types, single source of truth) |
| Tooling      | PNPM workspaces, ESLint 9, Playwright                          |

---

## Architecture Highlight

ForgeFlow WMS runs entirely on the **Cloudflare ecosystem**:

- **Cloudflare Workers** (via Hono) — the API runs at the edge, with zero cold-start infrastructure to manage. This is serverless by default, globally distributed, and scales to zero when idle.
- **Cloudflare D1** — a serverless, replicated SQLite database. It gives us a familiar relational model (transactions, joins, `db.batch` for atomic multi-statement commits) without running a database server, and it works flawlessly in local development with `wrangler d1` so the exact same schema runs locally and in production.

**Monorepo separation of concerns:**

- `apps/web` — React/Vite SPA
- `apps/api` — Hono Worker + Better Auth + routing
- `packages/db` — Drizzle schema, relations, migrations
- `packages/contracts` — shared Zod contracts that generate identical TypeScript types for both sides of the wire

Because the frontend and backend import the **same contract package**, a Zod schema change is a compile error everywhere before it can ever become a runtime mismatch.

---

## Project Structure

```
forgeflow-wms/
├── apps/
│   ├── web/                     # React + Vite SPA (port 5173)
│   │   └── src/
│   │       ├── pages/           # login, dashboard, receiving, movements,
│   │       │                    # master-data, job-allocation, notifications, profile
│   │       ├── components/      # layout, ui primitives, charts
│   │       └── lib/             # api client, auth client, query hooks
│   └── api/                     # Hono Worker (port 8787)
│       ├── src/
│       │   ├── routes/          # warehouses, inventory, purchase-orders,
│       │   │                    # receiving, jobs, movements, analytics, dashboard
│       │   ├── services/        # movement, receiving, allocation, inventory, notification
│       │   ├── middleware/      # auth-required, rbac, error-handler, validate
│       │   └── auth.ts          # Better Auth configuration
│       └── wrangler.jsonc       # Worker + D1 bindings + production env
├── packages/
│   ├── db/                      # Drizzle schema, relations, D1 migrations
│   │   └── migrations/          # versioned SQL migrations (apply with D1)
│   └── contracts/               # Shared Zod schemas + inferred types
├── pnpm-workspace.yaml
└── package.json                 # workspace orchestration scripts
```

---

## Local Development Setup

### Prerequisites

- **Node.js ≥ 20**
- **pnpm ≥ 11** (`corepack enable` or install via npm)
- A **Cloudflare account** is only needed if you deploy; local development works fully offline with Wrangler's built-in SQLite.

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Copy the example env file and generate a secure auth secret:

```bash
# API Worker secrets (wrangler reads .dev.vars automatically)
Copy-Item .env.example apps/api/.dev.vars
```

Generate a secret (PowerShell-compatible):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Then edit `apps/api/.dev.vars`:

```ini
BETTER_AUTH_SECRET=<the-secret-you-just-generated>
BETTER_AUTH_URL=http://localhost:8787
ENVIRONMENT=development
TRUSTED_ORIGINS=http://localhost:5173
```

Optionally configure the web app's direct API base URL in `apps/web/.env.local`:

```ini
VITE_API_BASE_URL=http://localhost:8787
```

> **Note:** The web app also proxies `/api` → `http://127.0.0.1:8787` in `vite.config.ts`, so local development works even without `VITE_API_BASE_URL`. Keep every port above consistent — they must all point to the same API.

### 3. Apply database migrations (local D1)

```bash
pnpm db:up
```

This generates any pending migrations from the Drizzle schema and applies them to the local D1 database. Alternatively, run the steps separately:

```bash
pnpm db:generate        # generate SQL migrations from the Drizzle schema
pnpm db:migrate:local   # apply migrations to the local D1 database
```

### 4. Start the dev servers

```bash
pnpm dev
```

- **Web app:** http://localhost:5173
- **API Worker:** http://localhost:8787 (health check at `/api/health`)

### 5. Seed demo data

The API exposes an idempotent seed endpoint that creates the four role-based demo users and a week of demo stock movements. You can trigger it from the login screen or via curl:

```bash
curl -X POST http://localhost:8787/api/seed
```

Check the seed status anytime:

```bash
curl http://localhost:8787/api/seed/status
```

### Demo accounts

| Role     | Email                      | Password       | Permissions                                        |
|----------|----------------------------|----------------|----------------------------------------------------|
| Admin    | `admin@forgeflow.io`       | `admin123`     | Full access (master data, receiving, jobs, staff)  |
| Manager  | `manager@forgeflow.io`     | `manager123`   | Operational writes (receiving, jobs)               |
| Operator | `operator@forgeflow.io`    | `operator123`  | Day-to-day receiving and issuing                   |
| Auditor  | `auditor@forgeflow.io`     | `auditor123`   | **Read-only** — all write endpoints return `403`   |

### Useful commands

```bash
pnpm build                  # build all workspaces
pnpm typecheck              # TypeScript check across all workspaces
pnpm lint                   # ESLint over the monorepo
pnpm dev                    # run web + api concurrently
pnpm db:generate            # generate migrations from the schema
pnpm db:migrate:local       # apply migrations to local D1
pnpm db:up                  # generate + migrate in one step
```

> **Important:** Never use `drizzle push` against a shared/D1 database. This project uses explicit, versioned migrations only.

---

## Design Philosophy

ForgeFlow WMS is built to behave like a piece of internal corporate software — because that is what a real WMS is.

- **No public sign-up.** Accounts are provisioned by an administrator (seed data or staff master data), never self-registered. In enterprise systems, identity and roles are granted, not chosen.
- **Read-only profiles.** A user's profile page is informational only. Employee codes, display names, and roles are governed by the staff master data module, so identity stays a controlled source of truth.
- **High-density, flat UI.** The interface favors information density, monospaced numerics, compact tables, and clear status badges over decorative design. The goal is that a warehouse operator can scan, compare, and act on large volumes of data quickly.
- **Authorization on the server.** Client-side route guards are convenience, not security. Every endpoint enforces RBAC, and auditor accounts are hard-locked to read-only at the middleware layer.

---

## License

This project is a private portfolio showcase and is not licensed for reuse or redistribution.
