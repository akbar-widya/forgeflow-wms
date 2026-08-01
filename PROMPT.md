# Project Kickoff: ForgeFlow WMS (Enterprise Warehouse Management System)

We are building "ForgeFlow WMS", a high-density, mission-critical Enterprise Warehouse Management System. 

The application must allow warehouse operators and managers to seamlessly handle inbound logistics, inventory placement, outbound job allocations, and system auditing. 

The core screens and workflows to build include:
1. **Authentication:** Secure split-screen login.
2. **Stock Register & Analytics (Dashboard):** High-level KPIs, capacity charts, and a high-density inventory data table.
3. **Inbound PO Receiving:** Split-view form and table for shipment intake and line-item quality inspection gating.
4. **Job Shop Allocation (Outbound):** Bill of Materials (BOM) requisition table with dynamic "issue quantity" inputs and scrap returns.
5. **Stock Movement Ledger:** A highly filterable, comprehensive audit trail of all material movements.
6. **System Notifications:** An alert center for stock shortages, PO discrepancies, and system logs.

## Constraints & Tech Stack
You MUST strictly adhere to the project's internal documentation: `@DESIGN.md` and `@AGENTS.md`. 
- **Architecture:** Monorepo (PNPM Workspaces) separating frontend (`apps/web`), backend (`apps/api`), and database (`packages/db`).
- **Frontend:** React.js + TypeScript running on Vite.
- **Styling:** Tailwind CSS v4, shadcn/ui (managed via Shadcn MCP Server), Framer Motion, and Lucide React.
- **Backend:** Cloudflare Workers using Hono.js.
- **Database:** SQLite (Cloudflare D1) managed via Drizzle ORM.
- **Authentication:** Better Auth.

## Visual & UI Direction
Do NOT use generic consumer SaaS designs (no large rounded corners, no heavy drop shadows). You must use an "industrial flat" aesthetic (Ant Design / Mantis inspired) exactly as detailed in `@DESIGN.md`:
- **Borders & Shadows:** 1px borders (`#f0f0f0`), 4px border-radius, `shadow-none` (0px shadows).
- **Density:** High data density. Use 8px baseline grids, compact padding (12px-16px in tables), and `.surface-dim` (`#fafafa`) for alternating table rows.
- **App Shell:** Fixed 260px left sidebar and 64px top header. 

## Your Task (Phase 1)
For now, do not generate the full application code. I want you to act as the Principal Staff Engineer. 

Please analyze this request alongside `@DESIGN.md` and `@AGENTS.md`, then generate a comprehensive execution plan containing:
1. **Monorepo Architecture:** The exact folder and file structure for the PNPM workspace.
2. **Drizzle Data Model:** A visual representation (using a Mermaid.js Entity-Relationship diagram) of the SQLite database schema connecting Users, Inventory, POs, Jobs, and Movements.
3. **API & Route Plan:** The Hono.js endpoint structure and frontend React Router structure.
4. **Build Phases:** A logical, step-by-step implementation plan (starting from DB schema, to backend endpoints, to frontend shell, to specific screens).

Present this plan to me for approval before writing any implementation code.