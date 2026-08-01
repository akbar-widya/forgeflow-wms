# CRITICAL RULES - MUST FOLLOW

## RESPONSES
- Keep responses concise and to the point - unless the user asks otherwise.

## PLANNING MODE
- Always ask clarifying questions.
- Never assume design, tech stack or features.
- Use deep-dive sub-agents to assist with research.
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user.

## WORKSPACE & ARCHITECTURE
- **Monorepo:** This project uses a PNPM Workspaces architecture.
- Understand the strict separation of concerns (e.g., `apps/web` for React/Vite, `apps/api` for Hono/Cloudflare Workers, `packages/db` for Drizzle schema).
- Ensure dependencies are correctly linked across the workspace so the frontend and backend can share TypeScript interfaces and types seamlessly.

## CHANGE / EDIT MODE
- Never implement features yourself when possible - use sub-agents!
- Identify changes from the plan that can be implemented in parallel.
- **Use the best model for the task: use premium models for complex tasks (like coding/architecture) and mid-tier models for simpler tasks, like code documentation.**
- After completing features, always run commands like `lint`, `type check`, and `pnpm build` (or `vite build`) to check code quality.
- **SHADCN MCP SERVER:** DO NOT build complex UI components from scratch. You MUST use natural language commands via the Shadcn MCP Server to search for and install components from the registry (e.g., "Find me a login form from the shadcn registry"). Modify the installed components to strictly match `@DESIGN.md`.

## DATABASE SCHEMA CHANGES
- This project uses SQLite (Cloudflare D1) with Drizzle ORM.
- Whenever you make changes to the database schema, ALWAYS run the `drizzle generate` and `drizzle migrate` commands (or the relevant `wrangler d1 migrations` commands).
- NEVER run `drizzle push`!
- For all ID columns outside of Better Auth, strictly use randomly generated UUIDs.

## GIT & VERSION CONTROL
- Practice **Atomic Commits**: Commit code iteratively for every logical unit of work completed.
- Use **Conventional Commits** in English (e.g., `feat(auth): integrate better-auth`, `ui(dashboard): implement flat cards`).

## TESTING
- Use any testing tools or MCPs (like Playwright) available to the project for testing your changes.
- Never assume your changes simply work, always test!

## UI DESIGN & AESTHETICS
- Always follow the UI design system when creating or reviewing components or pages.
- Design System: `@DESIGN.md`
- **CRITICAL:** Ensure all newly generated UI strictly adheres to the high-density, flat "industrial" UI instructions detailed in `@DESIGN.md`. Do not introduce large rounded corners, drop shadows, or generic consumer-SaaS styling.