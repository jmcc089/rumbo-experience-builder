# SBI-00 · Orchestration

> **Role:** This is the orchestrator — the glue that holds the whole build together. Individual SBIs do NOT communicate with each other. This file, together with `task_list.md`, is the single source of truth for what the project is, what has been built, and what comes next.
>
> **How this project is built:** One SBI at a time. After each SBI is completed and verified, run `/clear`, then `/next`. `/next` reloads this orchestrator and `task_list.md` to determine the current state and load the next SBI in sequence. SBIs are numbered so ordering is deterministic.
>
> **Language:** All deliverables and code artifacts are written in English.
>
> **Methodology:** This project follows the DA-BA methodology (Discovery · Architecture-Build · Assurance). Discovery and Architecture are complete. This SBI package IS the Build phase. Assurance comes after.

---

## 1. What is being built

**Rumbo** — the internal coordination system of an invented boutique inbound tour operator based in El Salvador, selling multi-day experiences to United States travelers.

A client submits a single request (dates, travelers, budget, and a description of how they picture their trip). The system coordinates with providers, then builds **3 complete, distinct multi-day itineraries** — each valid (violates no hard constraint) and good (optimized by weighted scoring) — covering activities, local transfers, meals, and lodging. The client picks one and completes a simulated payment.

**The core is a temporal constraint-satisfaction + optimization engine written in application code — NOT a prompt.** The LLM has a deliberately narrow role. Deterministic code has final say on everything that matters (validity, pricing, availability).

### The business model (load-bearing for pricing logic)
- Rumbo charges a **markup** on provider net rates. The client pays one all-in price; Rumbo keeps the difference.
- **`MARKUP_RATE = 0.30`** (30%, flat, parameterized as a constant — never hardcoded inline).
- The client's budget is validated against the **marked-up price**, never the provider net cost.
- Providers see only their **net rate** (what Rumbo pays them). They never see the client price or the markup.

### The three portals
1. **Client portal** (primary, most polished): landing → intake → status → proposals → payment.
2. **Provider portal**: inbox of availability requests → confirm/decline (with the net rate shown).
3. **Operator portal** (Rumbo's own dashboard): requests, orders, provider response status.

---

## 2. The pipeline (end to end)

```
1. Client fills intake (hard data + preference dropdowns + one free-text field) + email
   → request saved to DB (status: "building")
   → EMAIL 1 (plain: "we received your request")
   → page shows "we're building, we'll email you"

2. MATCH FILTER (static catalog data): select providers that apply
   (category, zone, dates, price-with-markup ≤ budget). Client never sees this.

3. AVAILABILITY FILTER (simulated): each candidate provider is "asked" via their portal.
   - formal provider → responds instantly (confirmation_mode: instant)
   - informal provider → responds or not (confirmation_mode: on_request); no response = discarded
   Confirmations live in a TEMPORARY CACHE (not DB), with the response window.

4. CSP VALIDATION over available pieces: feasible transfers, operating hours,
   dependencies (sunrise-only, tide-dependent), no-early-mornings if forbidden.

5. SCORING + ASSEMBLY: build top-3 DELIBERATELY DISTINCT itineraries, final price (markup applied).

6. When ready → EMAIL 2 (link to /proposals/{token}) reengages the client.

7. Client opens link → sees 3 proposals → 15-min hold starts WHEN THEY VIEW (not when email sent).
   Picks one → "pay" (no data collected, simulated) → status "paid" → order materialized to DB.

8. EMAIL 3 (purchase confirmation with itinerary details).

REPAIR (post-booking): a disruption generator (weighted by provider reliability) can knock
out a piece of a PAID itinerary. The same engine re-solves for that one gap with the rest fixed.
```

---

## 3. Architecture decisions (the "why" — fixed, do not re-litigate)

| Decision | Choice | Rationale |
|---|---|---|
| Core engine | Temporal CSP + weighted optimization in app code | The whole point: real backend logic, not an LLM wrapper. |
| Engine modes | Assembly (fill N days) + Repair (fill 1 gap, rest fixed) | Same engine, two entry points. |
| Day model | Continuous bounded time | Each activity consumes real `duration_min`; day has an operating window; pieces chained with transfers. More realistic, showcases scheduling logic. |
| Day chaining | Lodging as nightly anchor, multi-base | Days grouped by zone; one base per zone-block; base fixes next day's start point + first transfer. |
| Geography | Transfer matrix at ZONE level (~9-10 zones) | Region is only a label. |
| Validity/quality | Two layers: hard constraints (binary) then weighted scoring | Valid first, good second. Deterministic, testable. |
| Scoring metrics | 5: transfer efficiency, interest match, pace, breathing room, variety | Each normalized 0-1, combined by weighted sum. |
| Weights | Profile-based + client adjustment | 4 base profiles (Relaxed, Explorer, Focused, Comfortable); dropdowns place client in a profile; specific choices adjust; normalize to sum 1. Deterministic code, NOT the LLM. |
| Output | Top-3 deliberately distinct itineraries | Similarity penalty ensures they differ. |
| LLM role | Narrow: (a) extract hard constraints from free text (dietary, mobility), (b) personalization considerations (RAG over provider capability answers → provider instructions). NEVER touches selection, pricing, availability, or scoring weights. | Validated by Zod; fails safe to deterministic defaults. |
| Availability: background occupancy | Deterministic FUNCTION computed on the fly (NOT a table) | Derived from provider popularity + day/hour + seed. Keeps DB small, reproducible. |
| Availability: per-request confirmation | Temporary CACHE (not DB), 15-min hold | Only materializes to DB when client pays. |
| DB | Neon (managed Postgres, free tier) | Created manually via dashboard; connection string as env var. No MCP for Neon — that's fine. |
| Runtime | Node.js + TypeScript (strict) + Next.js | The Node/TS evidence the portfolio needs. |
| Deploy | Vercel (Hobby, $0) | Serverless. GitHub first, THEN connect Vercel to the GitHub repo (not the reverse). |
| Async | Status-pollable request + email notification (Resend) | No WebSockets/SSE (don't fit $0 serverless). |
| Provider comms | Dedicated provider portal (in real life a mobile app; here a web page). NOT WhatsApp. | Structured channel captures confirmation as system data. |
| Payment | Simulated. Button → "payment complete" state. No Stripe, no data collected. | Real payment (Stripe, legal, account linking) documented as out of scope. |
| Scalability | None by design | Portfolio exercise: demonstrate business-logic modeling + Node/TS + DA-BA. Not built to scale. |

---

## 4. Scope boundaries (what is deliberately OUT)

- International flights: context only (arrival/departure become day-1 and final-day hard constraints). Not coordinable inventory.
- Real payment integration (no Stripe / gateway).
- Real provider confirmation (all simulated).
- General post-sale service / complaints.
- Scalability, concurrency, high availability.

### Production-honesty notes (these DO go in the docs — SAD/README)
- In real production the provider catalog would come from real sources; here a curated seed reflects how a boutique inbound operator actually works.
- Provider comms would be a real app; here simulated via the provider portal.
- Real payment would require Stripe + account linking + legal compliance — out of scope.
- Contract/penalty/force-majeure with providers exists in the real business's legal plane, out of the build.
- **This project does not contemplate scalability or high concurrency by design; it is a business-modeling and technical-demonstration exercise. A production deployment would require revisiting infrastructure, concurrency, and persistence.**

> **NOTE — do NOT document:** provider-adoption friction in the informal market. Per the client's explicit instruction, this consideration goes nowhere in the deliverables.

---

## 5. Tech stack (exact)

| Layer | Choice |
|---|---|
| Language / runtime | Node.js + TypeScript (strict mode) |
| Framework | Next.js (App Router, TypeScript strict) |
| Deployment | Vercel (Hobby, $0) |
| Database | Neon (Postgres, free tier) — created manually via dashboard |
| Runtime validation | Zod (all external data, incl. LLM output) |
| LLM | DeepSeek (`deepseek-v4-flash`) — narrow role only |
| Email | Resend (3 transactional emails) |
| Fonts | Sarina (logo only), a sober serif for headings (e.g. Cormorant Garamond), a clean sans for body/UI. NOT Inter/Roboto/Arial/system as the display face. |

### Environment variables (names — set values in Vercel dashboard; Claude Code indicates when to add them)
- `DATABASE_URL` — Neon connection string
- `DEEPSEEK_API_KEY` — DeepSeek API key
- `RESEND_API_KEY` — Resend API key
- `APP_BASE_URL` — the deployed base URL (for building proposal links)

> **MCP over CLI:** prefer MCP tools where available (Vercel, Supabase, GitHub via connectors). Use CLI only when no MCP exists. Neon has no MCP — create the DB by hand in the Neon dashboard and paste the connection string as `DATABASE_URL`. Do NOT spend effort configuring manual MCP for Neon.

---

## 6. Brand & design system (embedded — Claude Code has no memory of prior sessions)

**Direction:** boutique-premium, airline-clean. Big presentation up top, direct action below. Lots of air, few elements per screen, typography-forward. NOT generic AI aesthetics.

### Palette (cobalt + gold, cool neutrals — NO warm beige/sand)
| Token | Hex | Use |
|---|---|---|
| Cobalt | `#0F47AF` | Primary — header, logo, headings |
| Navy ink | `#1E2A44` | Primary text (softer than pure black) |
| Off-white | `#FBFCFE` | Base / page background (cool, not beige) |
| Pale blue | `#E9EEF6` | Soft surfaces, cards, section fills |
| Gold | `#E0A44A` | Accent — primary CTAs, fine details, logo dot on light bg |

- Gold is an **accent, not a fill color**. CTAs, fine details, highlights. Never large areas (turns yellow, loses premium feel).
- Text on gold = dark navy (`#3a2a08`), never white (insufficient contrast).
- Logo: "Rumbo." — "Rumbo" in cobalt, the dot in gold on light backgrounds, or all-white on the cobalt header.

### Typography
- **Logo:** Sarina (Google Fonts) — display only, logo and nothing else.
- **Headings:** sober serif (Cormorant Garamond or similar) — editorial boutique voice.
- **Body / UI:** clean sans. NOT Inter, Roboto, Arial, or system fonts as the display face.

### Anti-generic rules (embedded so no external skill is required — see note below)
- Do NOT produce generic AI aesthetics: no Inter/Roboto/Arial as display, no purple-on-white gradients, no default three-card SaaS grid as the hero, no cookie-cutter layouts.
- Commit to the airline-premium direction above. Client portal gets personality; internal portals (provider, operator) stay clean and functional (tools, not marketing).
- Match implementation complexity to the vision — refined/minimal means restraint and precise spacing, not elaborate effects.
- Real photography of El Salvador is the intended hero/experience imagery (color blocks are placeholders until photos exist).

> **On the frontend-design skill:** In Claude Code, install by cloning Anthropic's repo into the project:
> `git clone https://github.com/anthropics/skills.git && cp -r skills/skills/frontend-design .claude/skills/`
> Claude Code auto-reads `.claude/skills/`. If not installed, the anti-generic rules above are embedded in each frontend SBI so the build does not depend on it.

---

## 7. Folder structure

```
rumbo_experience_builder/          ← project root (opened in Claude Code)
├── sbi/                            ← this package (orchestrator, task_list, SBIs)
├── documents/                     ← ADR content, SAD, README source, scope notes
└── project/                       ← ALL code is built here
```

Each SBI states which subfolders to create inside `project/` and where its outputs go.

---

## 8. Build model & agents

- **One SBI at a time.** Complete → verify → `/clear` → `/next`.
- **Task list is a living document.** After completing each SBI, mark its line done in `task_list.md` and note anything the next SBI must know (e.g. "schema table X created with columns Y").
- **Micro self-verification:** at the end of each SBI, the agent checks its output against that SBI's verification criteria before handing to the human checkpoint.
- **Sub-agents:** an SBI may dispatch sub-agents for parallelizable work within its scope (e.g. generating seed records against a fixed schema). Keep each sub-agent's context low and its task self-contained.

### ⚠️ Model selection per SBI
- **Most SBIs:** Sonnet 4.6 on **low** effort. Instructions are written to be executed mechanically — decisions are already made, not delegated.
- **Frontend SBIs (pages):** build with **Opus**, not Sonnet low. These are marked ⚠️ OPUS in `task_list.md` and in the SBI header. Design execution needs the stronger model. Pass the design system above + any available mockups as visual reference.

---

## 9. SBI sequence (dependency order)

| # | SBI | Model | Depends on |
|---|---|---|---|
| 00 | Orchestration (this file) | — | — |
| 01 | Project scaffold & tooling | Sonnet low | 00 |
| 02 | Data model & schema (DDL) | Sonnet low | 01 |
| 03 | Seed dataset (LLM-generated, schema-conformant) | Sonnet low | 02 |
| 04 | Availability & occupancy (deterministic functions) | Sonnet low | 02, 03 |
| 05 | The engine: CSP + scoring (assembly + repair) | Sonnet low | 02, 04 |
| 06 | LLM boundary: constraints + personalization (Zod) | Sonnet low | 02, 05 |
| 07 | Booking state machine + cache + orders | Sonnet low | 02, 04, 05 |
| 08 | Email layer (Resend, 3 templates) | Sonnet low | 02, 07 |
| 09 | Client portal — landing + intake | ⚠️ OPUS | 01, 06 |
| 10 | Client portal — status + proposals + payment | ⚠️ OPUS | 05, 07, 08, 09 |
| 11 | Provider portal | ⚠️ OPUS | 04, 07 |
| 12 | Operator dashboard | ⚠️ OPUS | 07 |
| 13 | Repair mode wiring + disruption generator | Sonnet low | 05, 07 |
| 14 | Deploy (GitHub → Vercel → Neon) + docs | Sonnet low | all |

> Full detail for each is in its own file. Read only the current SBI plus this orchestrator. Do not load all SBIs at once.

---

## 10. On completion

When all SBIs are done and marked in `task_list.md`, the Build phase is complete. The project then moves to **Assurance** (full verification + SAD + README), which is a separate DA-BA phase handled after this package.
