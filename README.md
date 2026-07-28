# Rumbo: An Itinerary Engine for Tours in El Salvador

> Source: Notion — https://app.notion.com/p/39cf9cdba74581a49a8deda7d50d4378
> Public case study — https://mauriciocruz.notion.site/Rumbo-An-Itinerary-Engine-for-tours-in-El-Salvador-39cf9cdba74581a49a8deda7d50d4378
> Markdown mirror of the Notion case study.

---

> Rumbo turns one client request (dates, party, budget, and a free-text description) into 3 complete, distinct, valid, optimized multi-day itineraries (activities, transfers, meals, lodging) through a temporal constraint-satisfaction and weighted-scoring engine written in application code, not an LLM prompt. The LLM is fenced to a narrow role: deterministic code has final say on validity, pricing, and availability.

---

## 1. Interactive Brief

https://rumbo-brief.netlify.app/

---

## 2. What Rumbo Does

A boutique inbound tour operator in El Salvador sells multi-day trips to US travelers. Rumbo is that operator's internal coordination system: one client request goes in, and three complete, bookable multi-day itineraries come out, each one validated day by day and priced on a markup the client never sees itemized.

1. **Takes one intake.** Dates, party size, budget, preference dropdowns, and one free-text description.
2. **Filters the catalog.** By category, operating days, and price with markup against the stated budget.
3. **Resolves provider availability.** Each matched experience is settled by a simulated responder at a flat 80% accept rate, in the same run as the match.
4. **Validates that each day is actually possible.** Transfers between zones, operating hours, sunrise and tide dependencies, and no early starts when the traveler ruled them out.
5. **Scores and assembles.** Five weighted metrics produce the top 3 deliberately distinct itineraries.
6. **Emails a link to compare and book.** The hold starts when the client opens the link, not when it is sent.
7. **Materializes the order on payment.** Simulated payment, confirmation email, and provider instructions generated.

### The three portals

**Client** — the public landing page and the three-step intake that starts everything: dates, party size, budget, preference dropdowns, and one free-text description of the trip they picture.
URL: https://rumbo-experience-builder.vercel.app

**Operator** — Rumbo's own view: margin on every order, incoming requests and their status, and the full provider catalog with inline editing. "Orders" shows real bookings with their margin.
URL: https://rumbo-experience-builder.vercel.app/operator

**Providers** — what a local business sees: its booked jobs and the history of how its requests resolved, its own services and prices, and its own profile. It only ever sees its net rate, never the client price. A "Viewing as" switcher at the bottom of the sidebar changes which business you are.
URL: https://rumbo-experience-builder.vercel.app/provider

---

## 3. System Design

Assembling a multi-day trip is not a CRUD problem. It is temporal constraint satisfaction plus optimization. Each day is a continuous bounded window. Each activity consumes real time and has to be chained by feasible transfers between zones. Some activities only run at sunrise or depend on the tide. Providers have operating hours, capacity, and their own confirmation behavior. Lodging anchors every night.

Feasibility is only half of it. An itinerary also has to be **good**: paced correctly, matched to the traveler's interests, with breathing room and variety, and priced so the budget is checked against the marked-up total and never against the provider's net cost.

That combination is real backend logic, and it has to be verifiable. Handing it to a language model would make it unverifiable. So the engine is deterministic code, and the LLM is fenced away from anything that decides feasibility or money. Everything below follows from that one commitment.

### 3.1 Requirements

#### Functional

- One intake produces **3 complete, distinct, valid, scored** multi-day itineraries covering activities, transfers, meals, and lodging.
- A coarse match filter over the static catalog: category, operating days, and price with markup against the stated budget.
- Per-request provider availability resolved synchronously: every matched experience is settled by a simulated responder at a flat 80% accept rate, and the provider portal keeps a read-only record of how each request resolved.
- Temporal CSP validity: feasible transfers, operating hours, sunrise and tide dependencies, and no early starts when the traveler rules them out.
- Weighted scoring across 5 metrics, with the top 3 selected under a distinctness guarantee.
- A proposal hold that starts when the client **opens** the link, not when it is sent.
- Simulated payment, order materialization, and a confirmation email.
- An operator dashboard with margin per order, inline catalog editing, and order cancellation.

#### Non-functional and hard rules

- **Deterministic engine.** Given the same request and the same set of accepted providers, the assembly and scoring engine always produces the same itineraries, using seeded hashing and no `Math.random()`. The only deliberate randomness is the simulated provider acceptance, which lives outside the engine (see ADR-6).
- **LLM-fenced.** Nothing the LLM returns can touch validity, pricing, availability, or scoring weights. Every response is Zod-validated and fails safe to deterministic defaults.
- **Price-partitioned.** Providers see only net rates, clients see only the all-in price. Neither can leak into the other's surface.
- **No authentication, by design.** The portals are demonstration surfaces. Provider identity is picked from a switcher instead of a login, and the portal says so on screen.
- **$0 hosting.** One Next.js app on Vercel Hobby plus the Neon free tier. Async is poll and email, no WebSockets.
- **No scalability by design.** A business-modeling and technical-demonstration exercise, not built to scale.

### 3.2 Architecture Decisions (ADRs)

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
The assembly and scoring engine is fully deterministic: given the same request and the same set of accepted experiences, it always returns the same itineraries, using seeded FNV-1a hashing and no `Math.random()`, which makes the core logic testable and debuggable. The randomness in the system is intentional and lives outside the engine. Every matched experience is settled by a simulated responder that accepts at a flat 80% through `Math.random()`, modeling the real-world uncertainty of whether a provider is free. Two identical requests can therefore land on different accepted sets, but each accepted set assembles into one fixed, reproducible result.

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

**ADR-15 · Provider availability is resolved synchronously, in the same run as the match.**
One pipeline run matches the catalog, settles every matched experience through a simulated responder that accepts at a flat 80% rate, and assembles proposals from the accepted set. Submit to proposals takes one to two seconds, measured end to end. An acceptance window was built first, on the premise that a provider would answer in real time from a portal inbox, and that premise does not survive contact with the timings: nobody is watching an inbox during the couple of seconds a request takes to resolve, so accept and decline were decorative buttons and the window bought nothing but latency. Removing it also removes everything that existed only to close it. The provider portal keeps "Recent history" as a read-only record of how each request resolved. The honest cost is that acceptance is now entirely simulated, with no path for a real one: reaching a provider for a genuine answer needs a channel they already watch, such as a mobile app with push notifications, which is a different mechanism from a web inbox and a countdown.

### 3.3 Pipeline

```
ON INTAKE — one synchronous run, fired via after()
1. Intake saved (status: building) ────────────────▶ Email 1 (acknowledgment)
2. MATCH FILTER (catalog): category · open days · price-with-markup ≤ budget
3. RESOLVE: every matched experience settled by a simulated responder at a flat 80% accept
4. CSP VALIDATION: feasible transfers · operating hours · sunrise/tide deps · no-early-mornings
5. SCORING + ASSEMBLY: 5 weighted metrics → top-3 DISTINCT itineraries → apply markup
6. Proposals ready ────────────────────────────────▶ Email 2 (link to /proposals/{token})

7. Client opens link → 1-hour hold starts ON VIEW → picks one → simulated pay
8. Order materialized to DB ───────────────────────▶ Email 3 (confirmation)

No acceptance window and no scheduler: steps 2 through 6 are one call, about one to two
seconds end to end. The client's status page polls only to notice that it already finished.
```

**The engine:** `assemble(problem)` is the single entry point over the CSP and scoring core. It fills every day of a new trip and returns up to 3 valid, distinct (Jaccard similarity < 0.6), scored proposals.

**Scoring:** five metrics normalized to 0 through 1 and combined by a weight vector that sums to 1: *transfer efficiency, interest match, pace, breathing room, variety.* The weights are derived deterministically from the client's dropdowns, starting from one of four profiles (Relaxed, Explorer, Focused, Comfortable) and then nudged and renormalized. The LLM never touches them.

### 3.4 Data Model

Eleven tables, split into a catalog and a transactional set.

| Group | Tables | Role |
| --- | --- | --- |
| **Catalog** | `zones`, `transfer_matrix`, `providers`, `experiences`, `lodging`, `provider_personalization` | The world: zones and zone-level travel times, providers (formal or informal, reliability, popularity), experiences (hours, duration, net price per person, capacity, dependency), lodging tiers, and provider capability answers |
| **Request** | `client_requests`, `proposal_cache` | The intake, with preferences and the persisted LLM extraction, plus the ephemeral 3-proposal hold that starts on first view and is never a booking |
| **Order** | `orders`, `order_items` | Written only on a completed purchase. `order_items` carries one row per booked experience and lodging night at its net price, which is what the operator's margin is derived from |
| **Provider** | `provider_responses` | How each matched experience resolved, confirmed or declined, holding `net_rate` only and never the client price |

The catalog is seeded, but it is not read-only. The provider portal writes to `experiences`, `providers`, and `provider_personalization` when a business edits its own services, prices, or profile, and the operator writes to the same tables through inline catalog editing. Every one of those writes is scoped server-side to the provider that owns the row.

### 3.5 Scope

A portfolio build: the smallest system that proves the pattern end to end, not a production deployment at scale.

**Out of scope by choice:**

- **Real payment.** Payment is a button and a paid state, with no Stripe, no PCI surface, and no data collected (see ADR-9).
- **A real provider communication channel.** Availability is simulated rather than asked, and the portal shows a provider how its requests resolved rather than letting it answer them (see ADR-15). There is no provider chat and no WhatsApp or SMS request link. A real build would reach providers on a channel they already watch, such as a mobile app with push notifications, but the confirmation it captures would stay structured: validated system data with the net rate attached, where a free-text chat would capture an unstructured message that the engine could neither price nor act on.
- **Rich media.** Experiences and lodging are described in text. There are no photos or videos per experience or per stay, which a real client-facing product would need to sell a trip.
- **International flights as inventory.** Arrival and departure are context-only constraints that bound the first and last day, not booked flights.
- **General post-sale service.** No support desk, changes, or cancellations beyond the operator's hard-delete.
- **Authentication.** The portals are open demonstration surfaces (see the hard rules and ADR-11).
- **Scalability, concurrency, and high availability** (see ADR-10).

**What production would require.** These are not planned next steps. They mark where the demo's deliberate boundaries sit and what crossing each one would actually cost, which is the difference between a portfolio build and a product.

- A production catalog would be sourced from real providers, not seeded.
- Provider communication would be a real mobile app with push notifications in place of the simulated availability step, while keeping the confirmation itself structured.
- Selling a trip would need a media pipeline, with photos and video attached to every experience and stay.
- Lodging and transport would be modeled as contracted suppliers with real rates and availability, which is the shared gap behind ADR-12 and ADR-14.
- Authentication with per-provider authorization would sit on top of the writes that are already server-side scoped today.
- Persistence and concurrency would be revisited from scratch rather than hardened from what is here.

---

## 4. Build Evidence

GitHub: https://github.com/jmcc089/rumbo-experience-builder

### 4.1 The Stack

| Layer | Tool | Purpose |
| --- | --- | --- |
| **Language / runtime** | Node.js + TypeScript (strict) | The whole system: engine, portals, services |
| **Framework** | Next.js (App Router) | Three portals plus Server Actions as the RPC surface |
| **Database** | Neon (Postgres, free tier) | Catalog and transactional tables |
| **Validation** | Zod | All external data, including every LLM response |
| **AI** | DeepSeek `deepseek-v4-flash` | Narrow, fenced role: free-text constraints and personalization notes |
| **Email** | Resend | 3 transactional emails: acknowledgment, proposals-ready, confirmation |
| **Scheduling** | None | Nothing is deferred: the whole pipeline runs in the call that fires from intake |
| **Deploy** | Vercel | Serverless; GitHub-first, then Vercel connected to the repo |

### 4.2 Request Flow

```
Client fills intake (name, email, dates, party, budget, prefs, free text)
   │  Server Action: submitIntake()
   ▼
createRequest()          → insert client_requests (status: building) → Email 1
   │
runRequestPipeline()     → one synchronous run:
   extractConstraints()      DeepSeek, Zod-validated, safe-default on any error
   matchFilter()             catalog: category · open-days · price-with-markup ≤ budget
   resolve + record          every match settled at a flat 80% accept → provider_responses
   assemble()                CSP validity → 5-metric scoring → top-3 distinct → applyMarkup()
   saveProposals()           proposal_cache · status=proposals_ready → Email 2 (link)
   ▼
(the provider portal shows how each request resolved, read-only, after the fact)
   ▼
getProposals(token)      → 1-hour hold starts on FIRST view (idempotent)
confirmAndPay()          → insert orders + order_items (txn) → Email 3
```

### 4.3 Project Structure

```
project/src/
├── lib/
│   ├── db/            schema.sql · migrate.ts · shared Neon pool
│   ├── types/         shared TS types across engine, booking, portals
│   ├── engine/        CSP validity + 5-metric scoring; assemble()
│   ├── llm/           Zod-fenced extraction, personalization, weight derivation
│   ├── pricing/       MARKUP_RATE, applyMarkup(); single source of truth
│   ├── booking/       request lifecycle · availability resolution · proposal hold · orders
│   ├── email/         3 Resend templates + client
│   ├── provider/      resolved-request history + own catalog/profile writes (net-rate-only)
│   ├── operator/      dashboard aggregates + inline catalog editing + order cancel
│   └── config.ts      trip-span, provider accept rate
└── app/
    ├── (client)/
    │   ├── page.tsx       landing + photo hero + 3-step intake
    │   ├── proposals/     3-proposal comparison + simulated payment
    │   └── status/        status polling (poll, not WebSockets)
    └── (internal)/
        ├── operator/      dashboard · Orders · Providers (inline catalog editing)
        └── provider/      3-section portal: Bookings · Services · Information
```

### 4.4 Configuration and fail-safe behavior

The system degrades instead of breaking when a dependency is missing. With no DeepSeek key the LLM falls back to deterministic defaults, so free-text extraction and personalization simply return safe values and nothing that decides feasibility or price is affected. With no Resend key every email becomes a logged no-op, so the pipeline runs end to end without sending. `DATABASE_URL` is the only hard requirement, and the schema lives in `schema.sql` while the catalog itself lives in the Neon database. Nothing external triggers the pipeline, so there is no scheduler credential and no shared secret to hold: the whole run happens inside the request that created it.

---

## 5. Key Engineering Choices

| Decision | What was chosen | Why |
| --- | --- | --- |
| **Core logic** | Temporal CSP and weighted scoring in application code | Provably correct backend logic, the whole point, not an LLM wrapper |
| **LLM role** | Narrow, Zod-fenced, fail-safe | Deterministic code owns validity, pricing, and availability; the LLM can never leak into feasibility or money |
| **Determinism** | Deterministic engine, seeded hashing, no `Math.random()` | The same request and accepted set reproduce the same itineraries; the only randomness is the deliberate provider-acceptance simulation |
| **Pricing** | Single `applyMarkup()`, net and client partitioned | Providers never see the client price and clients never see net, an architectural invariant |
| **Availability** | Resolved synchronously at a flat 80% accept | A window only made sense if a provider would answer inside it, and at one to two seconds nobody can; the portal keeps the record instead |
| **Proposals** | Top 3 with Jaccard similarity < 0.6 | Three genuinely different options, not three near-duplicates |
| **Provider portal** | Self-service, a switcher instead of a login, net-rate-only | Providers own and edit their catalog, prices, and profile, with every write scoped server-side |
| **Async** | One synchronous run plus email, no WebSockets | Fits $0 serverless with nothing always-on: there is nothing to wait for, so the status page only polls to notice the run already finished |

---

## Links

- Notion case study: https://mauriciocruz.notion.site/Rumbo-An-Itinerary-Engine-for-tours-in-El-Salvador-39cf9cdba74581a49a8deda7d50d4378
- Walkthrough (slides): https://rumbo-brief.netlify.app
- Live app (client): https://rumbo-experience-builder.vercel.app
- Operator dashboard: https://rumbo-experience-builder.vercel.app/operator
- Provider portal: https://rumbo-experience-builder.vercel.app/provider
- GitHub: https://github.com/jmcc089/rumbo-experience-builder
