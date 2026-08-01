# ForgeFlow WMS Phase 1 Execution Plan

## Approved Decisions

| Area | Decision |
| --- | --- |
| Warehousing | Multi-warehouse from day one |
| Tracking | Lot + expiry tracking included; serial tracking deferred |
| Stock balances | Materialized `stock_balances` table plus immutable movement ledger |
| Roles | `operator`, `manager`, `admin`, `auditor` |
| Frontend deploy | Cloudflare Pages |
| Shared contracts | Add `packages/contracts` for Zod schemas, DTOs, enums, filters |
| Model selection rule | Use premium models for complex coding/architecture; mid-tier models for simpler tasks like code documentation |

## Monorepo Structure

```txt
forgeflow-wms/
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  tsconfig.base.json
  eslint.config.js
  .env.example
  DESIGN.md
  AGENTS.md

  apps/
    web/
      package.json
      vite.config.ts
      components.json
      index.html
      src/
        main.tsx
        globals.css
        app/
          router.tsx
          providers.tsx
        layouts/
          auth-layout.tsx
          app-shell.tsx
        lib/
          api-client.ts
          auth-client.ts
          query-client.ts
          route-guards.tsx
        components/
          ui/
          shell/
            sidebar.tsx
            top-header.tsx
          data/
            industrial-data-table.tsx
            table-toolbar.tsx
            status-badge.tsx
        features/
          auth/
            login-page.tsx
          dashboard/
            stock-register-dashboard.tsx
            kpi-strip.tsx
            capacity-chart.tsx
            inventory-table.tsx
          inbound/
            po-receiving-page.tsx
            receipt-form.tsx
            inspection-gate-table.tsx
          outbound/
            job-allocation-page.tsx
            bom-issue-table.tsx
            scrap-return-panel.tsx
          movements/
            movement-ledger-page.tsx
            movement-filter-bar.tsx
          notifications/
            notifications-page.tsx
            alert-center.tsx

    api/
      package.json
      wrangler.jsonc
      tsconfig.json
      src/
        index.ts
        env.ts
        db.ts
        auth.ts
        middleware/
          auth-required.ts
          rbac.ts
          error-handler.ts
          validate.ts
        routes/
          health.ts
          auth.ts
          dashboard.ts
          inventory.ts
          warehouses.ts
          purchase-orders.ts
          receiving.ts
          jobs.ts
          movements.ts
          notifications.ts
        services/
          inventory-service.ts
          movement-service.ts
          receiving-service.ts
          allocation-service.ts
          notification-service.ts
        lib/
          http.ts
          pagination.ts
          idempotency.ts

  packages/
    db/
      package.json
      drizzle.config.ts
      src/
        index.ts
        client.ts
        relations.ts
        types.ts
        schema/
          auth.ts
          staff.ts
          warehouse.ts
          inventory.ts
          purchasing.ts
          jobs.ts
          movements.ts
          notifications.ts
          idempotency.ts
      migrations/

    contracts/
      package.json
      src/
        index.ts
        common.ts
        auth.ts
        roles.ts
        warehouse.ts
        inventory.ts
        purchasing.ts
        receiving.ts
        jobs.ts
        movements.ts
        notifications.ts
```

## Database ERD

```mermaid
erDiagram
  AUTH_USER ||--o| STAFF_PROFILE : maps_to
  STAFF_PROFILE ||--o{ STOCK_MOVEMENT : performs
  STAFF_PROFILE ||--o{ NOTIFICATION : receives

  WAREHOUSE ||--o{ ZONE : contains
  ZONE ||--o{ LOCATION : contains
  WAREHOUSE ||--o{ PURCHASE_ORDER : receives
  WAREHOUSE ||--o{ JOB : fulfills
  WAREHOUSE ||--o{ STOCK_BALANCE : owns

  LOCATION ||--o{ STOCK_BALANCE : stores
  LOCATION ||--o{ STOCK_MOVEMENT : from_location
  LOCATION ||--o{ STOCK_MOVEMENT : to_location

  ITEM ||--o{ ITEM_LOT : has_lots
  ITEM ||--o{ STOCK_BALANCE : has_balance
  ITEM ||--o{ PURCHASE_ORDER_LINE : ordered_as
  ITEM ||--o{ JOB_BOM_LINE : required_as
  ITEM ||--o{ STOCK_MOVEMENT : moved_as

  ITEM_LOT ||--o{ STOCK_BALANCE : tracked_in
  ITEM_LOT ||--o{ STOCK_MOVEMENT : moved_in

  PURCHASE_ORDER ||--o{ PURCHASE_ORDER_LINE : includes
  PURCHASE_ORDER ||--o{ RECEIPT : received_by
  PURCHASE_ORDER_LINE ||--o{ RECEIPT_LINE : received_line
  RECEIPT ||--o{ RECEIPT_LINE : includes
  RECEIPT_LINE ||--o| QUALITY_INSPECTION : gated_by
  RECEIPT_LINE ||--o{ STOCK_MOVEMENT : creates

  JOB ||--o{ JOB_BOM_LINE : requires
  JOB_BOM_LINE ||--o{ JOB_ISSUE : issued_against
  JOB_ISSUE ||--o{ STOCK_MOVEMENT : creates
  JOB ||--o{ SCRAP_RETURN : returns
  SCRAP_RETURN ||--o{ STOCK_MOVEMENT : creates

  STOCK_MOVEMENT ||--o{ NOTIFICATION : may_trigger
  IDEMPOTENCY_KEY ||--o| STOCK_MOVEMENT : protects

  AUTH_USER {
    text id PK
    text email UK
    text name
    integer email_verified
    text image
    integer created_at
    integer updated_at
  }

  STAFF_PROFILE {
    text id PK "uuid"
    text auth_user_id FK
    text employee_code UK
    text display_name
    text role "operator|manager|admin|auditor"
    text status
    integer created_at
    integer updated_at
  }

  WAREHOUSE {
    text id PK "uuid"
    text code UK
    text name
    text status
    integer created_at
    integer updated_at
  }

  ZONE {
    text id PK "uuid"
    text warehouse_id FK
    text code
    text name
    text type
    text status
  }

  LOCATION {
    text id PK "uuid"
    text warehouse_id FK
    text zone_id FK
    text code UK
    text location_type
    real capacity_qty
    text status
  }

  ITEM {
    text id PK "uuid"
    text sku UK
    text name
    text uom
    text category
    integer lot_tracked
    integer expiry_tracked
    integer serial_tracked "false in phase 1"
    real reorder_point
    text status
  }

  ITEM_LOT {
    text id PK "uuid"
    text item_id FK
    text lot_code
    integer expiry_date
    text quality_status
    integer created_at
  }

  STOCK_BALANCE {
    text id PK "uuid"
    text warehouse_id FK
    text location_id FK
    text item_id FK
    text lot_id FK
    real on_hand_qty
    real allocated_qty
    real available_qty
    text stock_status
    integer updated_at
  }

  PURCHASE_ORDER {
    text id PK "uuid"
    text warehouse_id FK
    text po_number UK
    text supplier_name
    text status
    integer expected_date
    integer created_at
  }

  PURCHASE_ORDER_LINE {
    text id PK "uuid"
    text purchase_order_id FK
    text item_id FK
    real ordered_qty
    real received_qty
    text status
  }

  RECEIPT {
    text id PK "uuid"
    text warehouse_id FK
    text purchase_order_id FK
    text receipt_number UK
    text status
    text received_by FK
    integer received_at
  }

  RECEIPT_LINE {
    text id PK "uuid"
    text receipt_id FK
    text purchase_order_line_id FK
    text item_id FK
    text lot_id FK
    text target_location_id FK
    real received_qty
    real accepted_qty
    real rejected_qty
    text status
  }

  QUALITY_INSPECTION {
    text id PK "uuid"
    text receipt_line_id FK
    text result
    text discrepancy_code
    text notes
    text inspected_by FK
    integer inspected_at
  }

  JOB {
    text id PK "uuid"
    text warehouse_id FK
    text job_number UK
    text work_order_ref
    text status
    integer due_date
    integer created_at
  }

  JOB_BOM_LINE {
    text id PK "uuid"
    text job_id FK
    text item_id FK
    real required_qty
    real issued_qty
    text status
  }

  JOB_ISSUE {
    text id PK "uuid"
    text job_bom_line_id FK
    text source_location_id FK
    real issue_qty
    text issued_by FK
    integer issued_at
  }

  SCRAP_RETURN {
    text id PK "uuid"
    text job_id FK
    text item_id FK
    text lot_id FK
    text target_location_id FK
    real return_qty
    text reason_code
    text returned_by FK
    integer returned_at
  }

  STOCK_MOVEMENT {
    text id PK "uuid"
    text warehouse_id FK
    text item_id FK
    text lot_id FK
    text from_location_id FK
    text to_location_id FK
    real qty_delta
    text movement_type
    text reference_type
    text reference_id
    text performed_by FK
    integer occurred_at
  }

  NOTIFICATION {
    text id PK "uuid"
    text user_id FK
    text movement_id FK
    text severity
    text type
    text title
    text message
    integer read_at
    integer created_at
  }

  IDEMPOTENCY_KEY {
    text id PK "uuid"
    text key UK
    text route
    text request_hash
    text response_hash
    integer created_at
  }
```

## API Plan

Base path: `/api`.

| Domain | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `ALL /auth/*`, `GET /me`, `POST /logout` |
| Dashboard | `GET /dashboard/kpis`, `GET /dashboard/capacity`, `GET /dashboard/inventory-summary` |
| Warehouses | `GET /warehouses`, `POST /warehouses`, `GET /warehouses/:id`, `GET /warehouses/:id/locations` |
| Inventory | `GET /inventory/items`, `POST /inventory/items`, `GET /inventory/items/:id`, `PATCH /inventory/items/:id` |
| Stock Balances | `GET /inventory/balances`, `GET /inventory/balances/:id` |
| Purchase Orders | `GET /purchase-orders`, `POST /purchase-orders`, `GET /purchase-orders/:id`, `PATCH /purchase-orders/:id` |
| Receiving | `POST /receipts`, `GET /receipts/:id`, `POST /receipts/:id/lines/:lineId/inspect`, `POST /receipts/:id/post` |
| Jobs | `GET /jobs`, `POST /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id`, `GET /jobs/:id/bom` |
| Allocation | `POST /jobs/:id/issues/preview`, `POST /jobs/:id/issues`, `POST /jobs/:id/scrap-returns` |
| Movements | `GET /movements`, `GET /movements/:id`, `POST /movements/adjustments`, `POST /movements/transfers` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |

## API Conventions

| Concern | Decision |
| --- | --- |
| Validation | Zod schemas from `packages/contracts` |
| Auth | Better Auth mounted in Hono |
| RBAC | Enforced server-side with `operator`, `manager`, `admin`, `auditor` |
| Auditor | Read-only access |
| Pagination | `page`, `pageSize`, `sort`, `direction` |
| Filtering | Validated query objects per route |
| Errors | `{ error: { code, message, details } }` |
| Stock mutation safety | Idempotency key required for receiving, issuing, adjustments, transfers |
| Inventory invariant | Ledger row and stock balance update happen in the same transactional unit |
| Ledger policy | Append-only except privileged correction workflow |

## Frontend Routes

| Route | Screen |
| --- | --- |
| `/login` | Split-screen secure login |
| `/` | Redirect to `/dashboard` |
| `/dashboard` | Stock Register & Analytics |
| `/inbound/receiving` | Inbound PO Receiving |
| `/outbound/job-allocation` | Job Shop Allocation |
| `/movements` | Stock Movement Ledger |
| `/notifications` | System Notifications |
| `/inventory/items/:id` | Item detail |
| `/purchase-orders/:id` | PO detail |
| `/jobs/:id` | Job detail |

## Frontend Implementation Rules

| Area | Plan |
| --- | --- |
| Routing | React Router |
| Server state | TanStack Query |
| Shared types | `packages/contracts` |
| App shell | Fixed `260px` sidebar, `64px` header |
| UI components | shadcn/ui via MCP, then adapted to `DESIGN.md` |
| Styling | Tailwind CSS v4, `@theme inline`, `globals.css` semantic tokens |
| Visual density | 1px borders, 4px radius, `shadow-none`, compact table cells |
| Deployment | Cloudflare Pages with API Worker URL configured per environment |

## Build Phases

| Phase | Work | Verification |
| --- | --- | --- |
| 1 | Create PNPM workspace skeleton, root configs, package boundaries | `pnpm install`, workspace package resolution |
| 2 | Create `packages/contracts` with shared enums, DTOs, filters, pagination, Zod schemas | `pnpm typecheck` |
| 3 | Create `packages/db` with Drizzle schema, Better Auth tables, WMS tables, relations | `drizzle generate`, D1 migration flow, no `drizzle push` |
| 4 | Create Hono Worker foundation, D1 binding, env validation, error middleware | `pnpm --filter api typecheck` |
| 5 | Integrate Better Auth, session handling, CORS, Pages-to-Worker cookie strategy | Auth smoke test |
| 6 | Implement RBAC middleware and route protection | Role-based route tests |
| 7 | Implement movement ledger and stock balance services | Unit/service tests for receiving, issue, adjustment invariants |
| 8 | Implement inventory, warehouse, PO, receiving, job, movement, notification API routes | API smoke tests |
| 9 | Create Vite React app, Tailwind v4 globals, providers, router, query client | `pnpm --filter web build` |
| 10 | Install/adapt shadcn primitives through MCP for forms, tables, buttons, badges, dialogs | Visual/design inspection |
| 11 | Build secure split-screen login and protected industrial app shell | Playwright login/app-shell smoke test |
| 12 | Build dashboard with KPIs, capacity charts, high-density inventory table | Playwright smoke test |
| 13 | Build inbound PO receiving with inspection gating | Workflow smoke test |
| 14 | Build outbound job allocation with issue quantities and scrap returns | Workflow smoke test |
| 15 | Build movement ledger and notifications center | Filter/read-state smoke test |
| 16 | Final hardening: lint, typecheck, build, migrations, Playwright | `pnpm lint`, `pnpm typecheck`, `pnpm build`, Playwright |

## Implementation Notes

All non-Better Auth IDs will be random UUIDs. Serial tracking is explicitly out of scope for Phase 1, but the schema will avoid blocking future serial-level traceability.

Cloudflare Pages and Worker environments need separate preview and production variables for API URL, Better Auth base URL, cookie domain, and D1 bindings.

Inventory write operations must be service-mediated. Receiving, issuing, adjustments, scrap returns, and transfers must create immutable ledger records and update materialized stock balances in the same transactional unit.
