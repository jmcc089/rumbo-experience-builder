# Rumbo: An Itinerary Engine for  Tours

> Rumbo turns one client request (dates, party, budget, and a free-text description) into 3 complete, distinct, valid, optimized multi-day itineraries (activities, transfers, meals, lodging) through a temporal constraint-satisfaction and weighted-scoring engine written in application code, not an LLM prompt. The LLM is fenced to a narrow role: deterministic code has final say on validity, pricing, and availability.

**Live app:** https://rumbo-experience-builder.vercel.app
**Operator dashboard:** https://rumbo-experience-builder.vercel.app/operator
**Provider portal:** https://rumbo-experience-builder.vercel.app/provider
**Walkthrough (slides):** https://rumbo-brief.netlify.app

---

## What Rumbo Does

A boutique inbound tour operator in El Salvador sells multi-day trips to US travelers. Rumbo is that operator's internal coordination system: one client request goes in, and three complete, bookable multi-day itineraries come out, each one validated day by day and priced on a markup the client never sees itemized.

1. **Takes one intake.** Dates, party size, budget, preference dropdowns, and one free-text description.
2. **Filters the catalog.** By category, operating days, and price with markup against the stated budget.
3. **Opens an acceptance window.** Each matched experience asks its provider to accept or decline; any request left unanswered is settled at a flat rate when the ~10-minute window closes.
4. **Validates that each day is actually possible.** Transfers between zones, operating hours, sunrise and tide dependencies, and no early starts when the traveler ruled them out.
5. **Scores and assembles.** Five weighted metrics produce the top 3 deliberately distinct itineraries.
6. **Emails a link to compare and book.** The hold starts when the client opens the link, not when it is sent.
7. **Materializes the order on payment.** Simulated payment, confirmation email, and provider instructions generated.

### Three portals

- **Client** — the public landing page and the three-step intake that starts everything: dates, party size, budget, preference dropdowns, and one free-text description of the trip they picture. → https://rumbo-experience-builder.vercel.app
- **Operator** — Rumbo's own view: margin on every order, incoming requests and their status, and the full provider catalog with inline editing. → https://rumbo-experience-builder.vercel.app/operator
- **Provider** — what a local business sees: it works its own inbox, manages its own services and prices, and edits its own profile. It only ever sees its net rate, never the client price. Use "Viewing as" at the bottom of the sidebar to switch between businesses. → https://rumbo-experience-builder.vercel.app/provider

---

## System Design

Assembling a multi-day trip is not a CRUD problem. It is temporal constraint satisfaction plus optimization. Each day is a continuous bounded window. Each activity consumes real time and has to be chained by feasible transfers between zones. Some activities only run at sunrise or depend on the tide. Providers have operating hours, capacity, and their own confirmation behavior. Lodging anchors every night.

Feasibility is only half of it. An itinerary also has to be **good**: paced correctly, matched to the traveler's interests, with breathing room and variety, and priced so the budget is checked against the marked-up total and never against the provider's net cost.

That combination is real backend logic, and it has to be verifiable. Handing it to a language model would make it unverifiable. So the engine is deterministic code, and the LLM is fenced away from anything that decides feasibility or money. Everything below follows from that one commitment.

### Requirements

**Functional**

- One intake produces **3 complete, distinct, valid, scored** multi-day itineraries covering activities, transfers, meals, and lodging.
- A coarse match filter over the catalog: category, operating days, and price with markup against the stated budget.
- Per-request provider availability as a real acceptance window: each matched experience opens a request the provider can accept or decline from its portal, and any request left unanswered is settled by a simulated responder at a flat 80% accept rate once the ~10-minute window closes.
- Temporal CSP validity: feasible transfers, operating hours, sunrise and tide dependencies, and no early starts when the traveler rules them out.
- Weighted scoring across 5 metrics, with the top 3 selected under a distinctness guarantee.
- A proposal hold that starts when the client **opens** the link, not when it is sent.
- Simulated payment, order materialization, and a confirmation email.
- An operator dashboard with margin per order, inline catalog editing, and order cancellation.

**Non-functional and hard rules**

- **Deterministic engine.** Given the same request and the same set of accepted providers, the assembly and scoring engine always produces the same itineraries, using seeded hashing and no `Math.random()`. The only deliberate randomness is the simulated provider acceptance, which lives outside the engine (see ADR-6).
- **LLM-fenced.** Nothing the LLM returns can touch validity, pricing, availability, or scoring weights. Every response is Zod-validated and fails safe to deterministic defaults.
- **Price-partitioned.** Providers see only net rates, clients see only the all-in price. Neither can leak into the other's surface.
- **No authentication, by design.** The portals are demonstration surfaces. Provider identity is picked from a switcher instead of a login, and the portal says so on screen.
- **$0 hosting.** One Next.js app on Vercel Hobby plus the Neon free tier. Async is poll and email, no WebSockets.
- **No scalability by design.** A business-modeling and technical-demonstration exercise, not built to scale.

### Architecture Decisions (ADRs)

**ADR-1 · The core is a temporal CSP and weighted-scoring engine in application code, not a prompt.**
The whole point of the build is provably correct backend logic, and validity and pricing have to be deterministic and testable rather than probabilistic. That rules out a language model deciding any of it. The cost is far more engine code than an LLM wrapper would need, which is precisely the demonstration.

**ADR-2 · Two-layer validity: hard constraints first, weighted scoring second.**
Only candidates that violate no hard constraint are ever scored. Valid first, good second. Keeping the two layers separate means feasibility and quality never contaminate each other, and each one can be tested on its own.

**ADR-3 · Continuous bounded-time day model, not fixed time slots.**
Each activity consumes its real `duration_min` inside a day window and is chained to the next by a transfer. Slots would have been simpler, but they turn scheduling into a lookup and hide the constraint logic the system exists to demonstrate.

**ADR-4 · Multi-base lodging: days grouped by zone, one base per zone-block.**
Days that share a zone share a base, and that base fixes the next day's starting point and first transfer. This mirrors how a real multi-region trip is actually staged, where a traveler changes base when the region changes rather than every night.

**ADR-5 · Flat 30% markup with a single source of truth.**
`MARKUP_RATE = 0.30` lives in exactly one place, the budget is validated against the marked-up price, and providers only ever see net. The business model is load-bearing for the pricing logic, so the rate cannot be inlined anywhere. One constant is the only way the net and client surfaces stay provably separate.

**ADR-6 · Determinism is scoped to the engine; the simulated availability is deliberately random.**
The assembly and scoring engine is fully deterministic: given the same request and the same set of accepted experiences, it always returns the same itineraries, using seeded FNV-1a hashing and no `Math.random()`, which makes the core logic testable and debuggable. The randomness in the system is intentional and lives outside the engine. When a provider does not answer within the acceptance window, a simulated responder accepts at a flat 80% through `Math.random()`, modeling the real-world uncertainty of whether a provider is free. Two identical requests can therefore land on different accepted sets, but each accepted set assembles into one fixed, reproducible result.

**ADR-7 · Per-request confirmation lives in an ephemeral cache, materialized to the database only on payment.**
Proposals sit in `proposal_cache` under a one-hour hold that starts when the client first opens the link, not when the email goes out. Only real purchases (simulated) should ever touch permanent tables. Starting the clock on send would punish a client for opening the email late, so the hold begins on view and is idempotent from then on.

**ADR-8 · The LLM is narrow and Zod-fenced.**
It does two additive things: extract dietary and mobility constraints from free text, and produce provider-personalization notes. Every response is validated and falls back to deterministic defaults on any error. Nothing it returns can reach validity, pricing, availability, or scoring weights, because deterministic code has to own everything that decides feasibility or money.

**ADR-9 · Payment is simulated, with no Stripe and no PCI surface.**
A button moves the order into a paid state, and no payment data is collected at any point. Real payment brings a gateway, legal exposure, and account linking, none of which teaches anything about the coordination problem this build is about.

**ADR-10 · No scalability or concurrency design, by choice.**
The exercise is business-logic modeling in Node and TypeScript, not infrastructure. There is no locking, no queueing, and no concurrency story. A production deployment would revisit persistence and concurrency from scratch rather than harden what is here.

**ADR-11 · The provider portal is self-service, with a switcher instead of a login.**
Each provider manages its own experiences, prices, and profile, and identity comes from a "Viewing as" control that states on screen that it exists for demonstration. The writes behind it are still scoped server-side: every provider write is guarded against the acting provider id, so the switcher chooses which provider you are, it does not grant access to another provider's rows. A real login per provider is table stakes in production, but it would add sessions and authorization without changing any of the coordination logic on display.

**ADR-12 · Lodging is anchored to a zone, not to a provider.**
`lodging` rows carry a `zone_id` and no `provider_id`, so lodging has no owner and never appears in the provider portal. In this system lodging is a base that anchors a night and fixes the next day's starting point, not a service that someone confirms. The engine selects it by tier and zone and simulates no availability for it, so there is nothing for an owner to accept or decline. A real operator would contract hotels as suppliers with negotiated rates and real availability, and modeling that means a `provider_id`, an availability path, and a lodging surface in the provider portal. That is a schema and flow change that adds no new logic to what is being demonstrated.

**ADR-13 · Cancelling an order is a hard delete, not a status change.**
The operator's Cancel order removes the request and everything downstream of it in a single transaction. The order lifecycle in this build ends at paid, and the schema carries no cancellation state. Adding one would require every read path to learn to exclude it, including dashboard aggregates, margin totals, and provider bookings, and a half-applied cancelled state is worse than none at all. Nothing here depends on an audit trail of cancelled orders, so removing the row keeps every downstream query honest without touching any of them. A soft-delete flag is the correct answer the moment cancellations carry money or need an audit trail, and it is the first thing to add in production.

**ADR-14 · Transport is modeled as time, not as a bookable service.**
`transfer_matrix` carries travel minutes between all 13 zones, and the engine uses it for feasibility and day-window fit. It has no cost, no provider, and no line in `order_items`. Transport time is what makes a day possible or impossible, and that is the constraint the engine exists to solve. Transport as a purchasable service is a separate business decision that would touch pricing, assembly, order items, and the client itinerary view without changing the scheduling logic at all. A complete version would add an intake field asking whether the traveler needs transport, routing to a full-service driver, a car rental provider, or nothing, and that runs into the same ownership gap as lodging in ADR-12, since no transport supplier exists as an entity. The lighter path, given that `transfer_matrix` already holds minutes per zone pair, is a flat or per-minute rate folded into the client price and shown as a line in the itinerary, with no provider confirming it.

**ADR-15 · Provider availability is a two-phase flow with an acceptance window closed by a cron, not a synchronous roll.**
When an intake arrives, phase one runs synchronously: the match filter selects candidate experiences and opens a real availability request for each, starting a roughly ten-minute acceptance window. No proposals are built yet. During the window, a provider can accept or decline from its portal inbox. Phase two runs once the window has closed: any request the provider did not answer is settled by a simulated responder that accepts at a flat 80% rate, and only then are proposals assembled from the accepted set, scored, and emailed. There is no always-on process in $0 serverless to watch the clock, so a GitHub Actions cron polls a finalize endpoint every five minutes and finalizes any request whose window has passed. A synchronous roll would have been simpler, but it turns the provider portal's accept and decline into decoration, since the trip would already be built before a provider could answer. Splitting the flow lets a real acceptance and a simulated one share exactly one finalize path.

### Pipeline

```text
PHASE 1 — on intake (synchronous)
1. Intake saved (status: building) ────────────────▶ Email 1 (acknowledgment)
2. MATCH FILTER (catalog): category · open days · price-with-markup ≤ budget
3. OPEN AVAILABILITY: one request per matched experience → a ~10-min acceptance window opens.
      During the window, providers accept or decline from their portal inbox.

PHASE 2 — after the window closes (driven by a cron poller)
4. RESOLVE: any request left unanswered is settled by a simulated responder at a flat 80% accept
5. CSP VALIDATION: feasible transfers · operating hours · sunrise/tide deps · no-early-mornings
6. SCORING + ASSEMBLY: 5 weighted metrics → top-3 DISTINCT itineraries → apply markup
7. Proposals ready ────────────────────────────────▶ Email 2 (link to /proposals/{token})

8. Client opens link → 1-hour hold starts ON VIEW → picks one → simulated pay
9. Order materialized to DB ───────────────────────▶ Email 3 (confirmation)

Cron: GitHub Actions polls /api/cron/finalize every 5 minutes and finalizes any request
whose acceptance window has closed. There is no always-on process in $0 serverless.
```

**The engine:** `assemble(problem)` is the single entry point over the CSP and scoring core. It fills every day of a new trip and returns up to 3 valid, distinct (Jaccard similarity < 0.6), scored proposals.

**Scoring:** five metrics normalized to 0 through 1 and combined by a weight vector that sums to 1: *transfer efficiency, interest match, pace, breathing room, variety.* The weights are derived deterministically from the client's dropdowns, starting from one of four profiles (Relaxed, Explorer, Focused, Comfortable) and then nudged and renormalized. The LLM never touches them.

### Data Model

Eleven tables, split into a catalog and a transactional set.

| Group | Tables | Role |
|---|---|---|
| **Catalog** | `zones`, `transfer_matrix`, `providers`, `experiences`, `lodging`, `provider_personalization` | The world: zones and zone-level travel times, providers (reliability and popularity signals), experiences (hours, duration, net price per person, capacity, dependency), lodging tiers, and provider capability answers |
| **Request** | `client_requests`, `proposal_cache` | The intake, with preferences and the persisted LLM extraction, plus the ephemeral 3-proposal hold that starts on first view and is never a booking |
| **Order** | `orders`, `order_items` | Written only on a completed purchase. `order_items` carries one row per booked experience and lodging night at its net price, which is what the operator's margin is derived from |
| **Provider** | `provider_responses` | Confirm or decline captured from the provider portal, holding `net_rate` only and never the client price |

The catalog is seeded, but it is not read-only. The provider portal writes to `experiences`, `providers`, and `provider_personalization` when a business edits its own services, prices, or profile, and the operator writes to the same tables through inline catalog editing. Every one of those writes is scoped server-side to the provider that owns the row.

### Scope

A portfolio build: the smallest system that proves the pattern end to end, not a production deployment at scale.

**Out of scope by choice:**

- **Real payment.** Payment is a button and a paid state, with no Stripe, no PCI surface, and no data collected (see ADR-9).
- **A real provider communication channel.** Providers are reached through the portal and a simulated availability step, not a live channel. There is no provider chat and no WhatsApp or SMS request link. A structured portal captures confirmation as validated system data with the net rate attached, where a free-text chat would capture an unstructured message that the engine could neither price nor act on. A real build would still add a messaging layer on top, but the confirmation itself would stay structured.
- **Rich media.** Experiences and lodging are described in text. There are no photos or videos per experience or per stay, which a real client-facing product would need to sell a trip.
- **International flights as inventory.** Arrival and departure are context-only constraints that bound the first and last day, not booked flights.
- **General post-sale service.** No support desk, changes, or cancellations beyond the operator's hard-delete.
- **Authentication.** The portals are open demonstration surfaces (see the hard rules and ADR-11).
- **Scalability, concurrency, and high availability** (see ADR-10).

**What production would require**

These are not planned next steps. They mark where the demo's deliberate boundaries sit and what crossing each one would actually cost, which is the difference between a portfolio build and a product.

- A production catalog would be sourced from real providers, not seeded.
- Provider communication would be a real mobile app with push notifications in place of the simulated availability step, while keeping the confirmation itself structured.
- Selling a trip would need a media pipeline, with photos and video attached to every experience and stay.
- Lodging and transport would be modeled as contracted suppliers with real rates and availability, which is the shared gap behind ADR-12 and ADR-14.
- Authentication with per-provider authorization would sit on top of the writes that are already server-side scoped today.
- Persistence and concurrency would be revisited from scratch rather than hardened from what is here.

---

## Build Evidence

### The Stack

| Layer | Tool | Purpose |
|---|---|---|
| **Language / runtime** | Node.js + TypeScript (strict) | The whole system: engine, portals, services |
| **Framework** | Next.js (App Router) | Three portals plus Server Actions as the RPC surface |
| **Database** | Neon (Postgres, free tier) | Catalog and transactional tables |
| **Validation** | Zod | All external data, including every LLM response |
| **AI** | DeepSeek `deepseek-v4-flash` | Narrow, fenced role: free-text constraints and personalization notes |
| **Email** | Resend | 3 transactional emails: acknowledgment, proposals-ready, confirmation |
| **Scheduling** | GitHub Actions cron | Polls the finalize endpoint every 5 minutes to close acceptance windows (Phase 2) |
| **Deploy** | Vercel | Serverless; GitHub-first, then Vercel connected to the repo |

### Request Flow

```text
Client fills intake (name, email, dates, party, budget, prefs, free text)
   │  Server Action: submitIntake()
   ▼
createRequest()          → insert client_requests (status: building) → Email 1
   │
runRequestPipeline()     → PHASE 1, synchronous:
   matchFilter()             catalog: category · open-days · price-with-markup ≤ budget
   startAvailabilityRequests() open one provider request per matched experience,
                               start the ~10-minute acceptance window
   ▼
(providers accept or decline from their portal inbox during the window)
   ▼
GitHub Actions cron  ──▶  POST /api/cron/finalize  (Bearer CRON_SECRET)
   getDueRequestIds()    → requests whose window has closed
   finalizeProposals()   → PHASE 2:
      resolve()             unanswered requests settled at a flat 80% accept rate
      extractConstraints()  DeepSeek, Zod-validated, safe-default on any error
      assemble()            CSP validity → 5-metric scoring → top-3 distinct → applyMarkup()
      saveProposals()       proposal_cache · status=proposals_ready → Email 2 (link)
   ▼
getProposals(token)      → 1-hour hold starts on FIRST view (idempotent)
confirmAndPay()          → insert orders + order_items (txn) → Email 3
```

### Project Structure

```text
project/src/
├── lib/
│   ├── db/            schema.sql · migrate.ts · shared Neon pool
│   ├── types/         shared TS types across engine, booking, portals
│   ├── engine/        CSP validity + 5-metric scoring; assemble()
│   ├── llm/           Zod-fenced extraction, personalization, weight derivation
│   ├── pricing/       MARKUP_RATE, applyMarkup(); single source of truth
│   ├── booking/       request lifecycle · two-phase availability · proposal hold · orders
│   ├── email/         3 Resend templates + client
│   ├── provider/      provider inbox + own catalog/profile writes (net-rate-only)
│   ├── operator/      dashboard aggregates + inline catalog editing + order cancel
│   └── config.ts      trip-span, acceptance-window minutes, provider accept rate
└── app/
    ├── (client)/
    │   ├── page.tsx       landing + photo hero + 3-step intake
    │   ├── proposals/     3-proposal comparison + simulated payment
    │   └── status/        status polling (poll, not WebSockets)
    ├── api/cron/finalize/ Phase 2 poller (GitHub Actions + CRON_SECRET)
    └── (internal)/
        ├── operator/      dashboard · Orders · Providers (inline catalog editing)
        └── provider/      3-section portal: Bookings · Services · Information
```

### Configuration and fail-safe behavior

The system degrades instead of breaking when a dependency is missing. With no DeepSeek key the LLM falls back to deterministic defaults, so free-text extraction and personalization simply return safe values and nothing that decides feasibility or price is affected. With no Resend key every email becomes a logged no-op, so the pipeline runs end to end without sending. `DATABASE_URL` is the only hard requirement, and the schema lives in `schema.sql` while the catalog itself lives in the Neon database. Phase 2 finalization is authenticated with `CRON_SECRET`, so only the scheduled poller can close acceptance windows.

---

## Key Engineering Choices

| Decision | What was chosen | Why |
|---|---|---|
| **Core logic** | Temporal CSP and weighted scoring in application code | Provably correct backend logic, the whole point, not an LLM wrapper |
| **LLM role** | Narrow, Zod-fenced, fail-safe | Deterministic code owns validity, pricing, and availability; the LLM can never leak into feasibility or money |
| **Determinism** | Deterministic engine, seeded hashing, no `Math.random()` | The same request and accepted set reproduce the same itineraries; the only randomness is the deliberate provider-acceptance simulation |
| **Pricing** | Single `applyMarkup()`, net and client partitioned | Providers never see the client price and clients never see net, an architectural invariant |
| **Availability** | Two-phase: a real acceptance window closed by a cron | A genuine accept or decline in the provider portal, not a synchronous roll; unanswered requests settle at a flat 80% |
| **Proposals** | Top 3 with Jaccard similarity < 0.6 | Three genuinely different options, not three near-duplicates |
| **Provider portal** | Self-service, a switcher instead of a login, net-rate-only | Providers own and edit their catalog, prices, and profile, with every write scoped server-side |
| **Async** | Cron poller plus email, no WebSockets | Fits $0 serverless: a GitHub Actions cron closes acceptance windows and triggers the proposals email |
