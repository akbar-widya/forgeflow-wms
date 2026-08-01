# Design System & Architecture: ForgeFlow WMS

This document is the absolute source of truth for the ForgeFlow WMS design system and tech stack. The interface is optimized for warehouse operations: tactical, precise, data-dense, and highly reliable. It uses a high-density, "industrial flat" visual system.

---

## 1. Technical Stack & Infrastructure
This project uses a strict Monorepo architecture (PNPM Workspaces) integrating frontend interfaces and edge-based backend services.

**Frontend & UI (Apps/Web):**
- **Framework:** React.js + TypeScript (Strict Mode) running on Vite.
- **Styling:** Tailwind CSS v4 (CSS-first config via `@theme inline` in `src/globals.css`).
- **Components:** shadcn/ui primitives (managed via MCP).
- **Icons & Animations:** Lucide React & Framer Motion.
- **Fonts:** Public Sans (UI) and IBM Plex Mono (Technical/SKUs).
- **State & Routing:** TanStack Query, Zustand, and React Router / TanStack Router.
- **Forms:** React Hook Form + Zod.
- **Color Mode:** Light mode primary (Force-Light), with support for system dark mode (via custom React ThemeProvider).

**Backend, Data & Infrastructure (Apps/API & Packages/DB):**
- **Backend & Deployment:** Cloudflare Workers (using Hono.js).
- **Database:** SQLite (running on Cloudflare D1).
- **ORM & Migrations:** Drizzle ORM.
- **Authentication:** Better Auth.
- **Package Manager:** PNPM.

---

## 2. Visual Direction
The app is a mission-critical warehouse command center, prioritizing information density over decorative flair.
- Use a clean "industrial white" palette with primary blue accents for actionable elements.
- Surfaces are flat with 1px borders; shadows are removed (0px) to maximize screen real estate and reduce visual noise.
- Data density is high: compact padding (12px-16px) and 8px baseline grid increments.
- Status is communicated through a specific semantic palette: Success (Green), Warning (Amber), Danger (Red), and Info (Blue).
- Layouts follow a strict sidebar-plus-header shell architecture.

---

## 3. Semantic Tokens
All semantic tokens live in `src/globals.css` and are bridged to Tailwind with `@theme inline`.

| Token | Light | Dark (Experimental) | Usage |
| --- | --- | --- | --- |
| `background` | `#f9f9ff` | `#0a0a0c` | Global app background |
| `foreground` | `#262626` | `#f1f3f9` | Primary text and headings |
| `card` | `#ffffff` | `#141416` | Container surfaces, modals |
| `primary` | `#1890ff` | `#177ddc` | Buttons, Active states, Brand accents |
| `secondary` | `#fafafa` | `#1f1f23` | Alternating rows, input backgrounds |
| `muted` | `#8c8c8c` | `#434343` | Secondary text, captions |
| `border` | `#f0f0f0` | `#303030` | 1px element separation |
| `success` | `#52c41a` | `#49aa19` | "Ready", "Inbound", "Passed" |
| `warning` | `#faad14` | `#d89614` | "Discrepancy", "Quarantine" |
| `danger` | `#ff4d4f` | `#a61d24` | "Shortage", "Scrap", "Critical" |

---

## 4. Typography
- **H1 (Page Title):** 24px / 600 weight / 1.2 line-height.
- **H2 (Card Title):** 20px / 600 weight / 1.3 line-height.
- **Label (Sm):** 12px / 500 weight / 1.2 line-height (Badges/Labels).
- **Body:** 14px / 400 weight / 1.5 line-height.

---

## 5. Core Utilities
Defined in `src/globals.css`:
- `.industrial-border`: Default 1px solid `#f0f0f0` stroke.
- `.surface-dim`: Alternating row color background `#fafafa`.
- `.status-badge`: Compact pill with 4px radius and low-saturation background tint.
- `.data-table-cell`: 12px 16px high-density padding.
- `.sidebar-nav-item`: 260px fixed width alignment with active right-border highlight.

---

## 6. Components

### Cards
Cards are flat, 1px bordered, and use a white background. No elevation.
- **Code:** `<Card className="rounded-none border-[#f0f0f0] shadow-none">`
- **Padding:** `p-6` (24px) for dashboard cards, `p-4` (16px) for compact toolbars.

### Buttons
- **Primary:** Solid `#1890ff`, white text, 4px radius. No shadow.
- **Secondary/Outline:** 1px gray border, `#262626` text, transparent background.
- **Ghost:** No border, blue text, subtle gray background on hover.

### Inputs
Inputs use a 1px `#f0f0f0` border, white or `#fafafa` background, and 4px radius. Focus state uses a 1px primary blue border with no glow.

### Badges
Used for status. Use a subtle background tint of the status color (Success/Warning/Danger) with high-contrast text. Weight should be Medium (500).

### Tables
The heart of the WMS. Use `border-collapse`, 1px borders, and `.surface-dim` for every other row. Headers should be light gray background with uppercase 12px labels.

---

## 7. Layout & App Shell
**Standard layout shell architecture:**
```tsx
<div className="flex min-h-screen bg-[#f9f9ff]">
  <aside className="w-[260px] border-r border-[#f0f0f0] bg-white fixed h-full">
    {/* Navigation */}
  </aside>
  <main className="flex-1 ml-[260px]">
    <header className="h-[64px] border-b border-[#f0f0f0] bg-white sticky top-0">
       {/* Breadcrumbs & Profile */}
    </header>
    <div className="p-6 max-w-[1600px] mx-auto">
       {/* Page Content */}
    </div>
  </main>
</div>