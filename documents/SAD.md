# Rumbo — Software Architecture Document (stub)

> Build-phase skeleton. The Assurance phase fills this in fully (diagrams, full data dictionary, non-functional analysis). This stub exists so the shape of the document — and the as-built inventory it needs to describe — is fixed before Assurance starts.

---

## 1. Purpose & scope

Rumbo coordinates the sale of multi-day inbound tour packages: client intake → provider matching/availability → itinerary assembly (CSP + scoring) → client selection → simulated payment → order → post-booking repair. See [README.md](README.md) for the product framing and [ADR.md](ADR.md) for the "why" behind each major decision below.

## 2. Components

| Component | Location | Responsibility |
|---|---|---|
| Data model / migrations | `project/src/lib/db` | Schema (`schema.sql`), migration runner, shared connection pool |
| Types | `project/src/lib/types` | Shared TS types across engine, booking, portals |
| Seed dataset | `project/src/seed` | Schema-conformant catalog (zones, providers, experiences, lodging, transfer matrix, personalization) |
| Availability | `project/src/lib/availability` | Deterministic background-occupancy function, confirmation resolution (formal/informal), FNV-1a hash utilities |
| Engine | `project/src/lib/engine` | Temporal CSP validity check + 5-metric weighted scoring; `assemble()` (fill N days) and `repair()` (fill 1 gap) entry points |
| LLM boundary | `project/src/lib/llm` | Deterministic weight derivation from dropdowns (`weights.ts`), Zod-validated free-text constraint extraction, provider-instruction personalization, safe-default fallbacks |
| Pricing | `project/src/lib/pricing` | `MARKUP_RATE`, `applyMarkup()` — single source of truth for client-price derivation |
| Booking | `project/src/lib/booking` | Request lifecycle (`createRequest` → `runRequestPipeline` → `getProposals` → `confirmAndPay`), proposal cache/hold, order materialization, presentation-layer enrichment (`enrich.ts`) |
| Email | `project/src/lib/email` | 3 transactional templates + Resend client, wired into booking lifecycle points |
| Provider portal service | `project/src/lib/provider` | Provider inbox (request × experience matching), response recording, net-rate-only exposure |
| Operator service | `project/src/lib/operator` | Read-only dashboard aggregates (metrics, recent requests, provider response panel), repair-demo order listing |
| Repair | `project/src/lib/repair` | Disruption generator (reliability-weighted, deterministic hash), repair invocation against the engine's `repair()` |
| Client portal (UI) | `project/src/app/{page,proposals,status}` | Landing, intake, status polling, proposals comparison + booking, confirmation |
| Provider portal (UI) | `project/src/app/provider` | Provider-context selector, inbox, history |
| Operator portal (UI) | `project/src/app/operator` | Metrics, recent requests, provider response panel, repair-demo controls |

## 3. Data model (summary — see `project/src/lib/db/schema.sql` for the authoritative DDL)

Core tables: `zones`, `transfer_matrix`, `providers`, `experiences`, `lodging`, `provider_personalization`, `client_requests`, `proposal_cache`, `orders`, `order_items`, `provider_responses`.

Key relationships: `experiences`/`lodging` reference `zones` and `providers`; `client_requests` carries `prefs_json` (dropdown preferences) and `extraction_json` (persisted LLM extraction output); `orders`/`order_items` are the only tables written on a completed purchase; `provider_responses` is the provider portal's captured-state table (not fed back into the engine — see [ADR.md](ADR.md) and Open Issues in `sbi/task_list.md`).

## 4. The engine (assembly + repair)

Two entry points over one CSP + scoring core:

- **`assemble(problem)`** — fills every day of a new itinerary from a candidate pool, returns up to 3 valid, distinct (Jaccard similarity < 0.6), scored proposals.
- **`repair(problem)`** — re-solves a single gap day in an already-paid itinerary, all other days held fixed.

Validity (hard constraints) is checked before scoring; only valid candidates are scored. Scoring combines 5 normalized metrics (transfer efficiency, interest match, pace, breathing room, variety) via profile-derived weights (see [ADR.md](ADR.md) ADR-01/02/03/04).

## 5. The pipeline (request → order)

See the pipeline diagram in [README.md](README.md). Implemented across `booking/pipeline.ts` (match filter → availability confirmation → LLM extraction → `assemble()`) and `booking/requests.ts` (`createRequest`, `getProposals` with hold semantics, `confirmAndPay` with transactional order materialization).

## 6. The three portals

See [README.md](README.md) §"The three portals" for the product view. Architecturally: the client portal is the most polished (marketing `Header`, design-system-forward); the provider and operator portals share a lighter internal-tool visual pattern (thin cobalt topbar, `globals.css` tokens reused, no marketing chrome) and no login anywhere in the system (URL/token or a plain selector is the only "auth").

## 7. Non-functional notes (expanded in Assurance)

- **Scalability:** explicitly out of scope by design (ADR-10).
- **Security:** no secrets committed; env vars only; provider net rates and client prices are architecturally partitioned so neither surface can leak into the other (verified per-SBI in `sbi/task_list.md`).
- **Observability:** none beyond Vercel/Neon's own dashboards — acceptable for this scope.

## 8. Open items carried into Assurance

See "Open issues / deviations" in `sbi/task_list.md` for the full list (dietary/mobility filter is currently a no-op, fire-and-forget pipeline trigger needs `after()` on serverless, provider portal doesn't re-drive the engine, trip-length cap at 5 days as an engine-diversity mitigation). Assurance should triage these explicitly rather than silently close them.
