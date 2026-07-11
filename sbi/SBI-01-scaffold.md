# SBI-01 · Project scaffold & tooling

> **Model:** Sonnet 4.6, low effort.
> **Depends on:** SBI-00.
> **Objective:** Create the Next.js + TypeScript project skeleton inside `project/`, with strict config, folder structure, Zod, and environment scaffolding — ready for all downstream SBIs.

---

## Inputs
- Orchestrator (SBI-00) for stack + folder conventions.

## What to produce

1. **Create the folder tree** at the project root:
   ```
   documents/          (empty for now; docs SBIs fill it)
   project/            (the Next.js app lives here)
   ```

2. **Scaffold a Next.js app inside `project/`** with:
   - TypeScript, **strict mode** on (`"strict": true` in tsconfig).
   - App Router.
   - ESLint enabled.
   - No Tailwind requirement is imposed by the architecture; if the scaffold offers it, it's acceptable, but the design system uses explicit CSS variables (see SBI-00 palette). Either is fine as long as the palette tokens are used.

3. **Install dependencies:**
   - `zod` (runtime validation)
   - `resend` (email — used in SBI-08)
   - The Postgres client for Neon (`@neondatabase/serverless` or `pg` — choose `@neondatabase/serverless`, it fits Vercel serverless best).
   - A migration approach: plain SQL files run via a small script is acceptable (no heavy ORM required). If you prefer a light query builder, keep it minimal. Do NOT introduce a large ORM — the schema is small and explicit.

4. **Framework-agnostic services layer:** create `project/src/lib/` (or `project/lib/`) where all business logic (engine, scoring, availability, booking, llm) will live as plain TypeScript modules, callable independently of Next.js route handlers. Route handlers stay thin. (No abstraction layers or adapters — just keep logic out of the handlers.)

5. **Environment file:** create `.env.example` listing the variable NAMES only (no values):
   ```
   DATABASE_URL=
   DEEPSEEK_API_KEY=
   RESEND_API_KEY=
   APP_BASE_URL=
   ```
   Add `.env` and `.env.local` to `.gitignore`. Confirm `node_modules` and `.next` are gitignored.

6. **Proposed internal structure** (create the empty folders so downstream SBIs have a home):
   ```
   project/src/
   ├── app/                 (Next.js routes + pages)
   ├── lib/
   │   ├── db/              (connection, schema, migrations)
   │   ├── engine/          (CSP + scoring)
   │   ├── availability/    (occupancy + confirmation functions)
   │   ├── booking/         (state machine, cache, orders)
   │   ├── llm/             (DeepSeek boundary, Zod schemas)
   │   ├── email/           (Resend templates + send)
   │   ├── pricing/         (markup constant + helpers)
   │   └── types/           (shared TS types)
   └── seed/                (seed data + load script)
   ```

7. **Pricing constant:** create `project/src/lib/pricing/index.ts` exporting:
   ```ts
   export const MARKUP_RATE = 0.30;
   export const applyMarkup = (net: number): number =>
     Math.round(net * (1 + MARKUP_RATE) * 100) / 100;
   ```

## Verification criteria
- `npm run dev` starts the Next.js app without errors.
- `npm run build` (or `next build`) compiles with no TypeScript errors under strict mode.
- The folder tree above exists.
- `.env.example` lists all four variable names; `.env*` is gitignored.
- `applyMarkup(100)` returns `130`.

## Do NOT
- Do NOT add authentication (no login anywhere in the project).
- Do NOT add a heavy ORM.
- Do NOT implement any business logic yet — this SBI is scaffold only.
- Do NOT commit any secret values.

## Handoff notes to write in task_list.md
- Exact framework version and whether Tailwind was included.
- The chosen Postgres client.
- The final internal folder paths (confirm they match the plan above or note deviations).
