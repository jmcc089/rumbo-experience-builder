# Rumbo — Architecture Decision Records

> Source content for the project's ADRs. Nygard-style (Context / Decision / Consequences), written to be pasted into a Notion page or similar. This is the Build-phase version; Assurance may expand these.

---

## ADR-01: The core is a temporal CSP + scoring engine written in application code, not a prompt

**Context.** Rumbo needs to produce 3 valid, good, multi-day itineraries from a pool of providers, experiences, and lodging, subject to hard constraints (dates, hours, dependencies, budget) and soft preferences (pace, interests, breathing room).

**Decision.** Build a deterministic constraint-satisfaction + weighted-optimization engine in TypeScript (`project/src/lib/engine`). The LLM is never asked to select, price, or validate an itinerary.

**Consequences.** Itinerary quality is testable and reproducible (same inputs → same outputs). The engine is the most substantial piece of business logic in the project and the centerpiece of the technical demonstration. Cost: more code to write and verify than a prompt-based approach, but correctness and auditability are non-negotiable for a system that touches money and provider commitments.

---

## ADR-02: Two-layer validity model — hard constraints (binary), then weighted scoring

**Context.** Some rules cannot be violated (an activity can't run outside its provider's open hours; a sunrise-only activity can't be scheduled at noon). Others are about *quality*, not correctness (pace, variety, transfer efficiency).

**Decision.** `checkValidity()` runs first and is binary — a candidate itinerary that fails any hard constraint is discarded outright. Only itineraries that pass validity are scored by the 5-metric weighted sum (transfer efficiency, interest match, pace, breathing room, variety), each normalized to [0,1].

**Consequences.** Validity and quality are independently testable. Scoring weights can be tuned (per client profile) without ever risking an invalid itinerary reaching the client.

---

## ADR-03: Continuous bounded-time day model, not fixed time slots

**Context.** Real activities have real durations and real transfer times between them; a slot-based model (e.g. "morning / afternoon / evening") loses information needed to detect genuinely infeasible days.

**Decision.** Each day is a continuous time window. Activities consume `duration_min`; transfers between zones consume real minutes from the transfer matrix; the engine chains pieces sequentially within the day's operating window.

**Consequences.** More realistic schedules, and a better showcase of scheduling logic — but more implementation complexity than fixed slots (parsing/formatting `HH:MM`, minute arithmetic throughout `engine/index.ts`).

---

## ADR-04: Multi-base lodging — days grouped by zone, one lodging "base" per zone-block

**Context.** A multi-day trip typically doesn't move lodging every night; a traveler bases themselves in one zone for several days, then moves.

**Decision.** Days are grouped into zone-blocks; each block has one lodging anchor. The base fixes the first transfer of each day in that block (from lodging to the day's first activity) and the day's overnight return.

**Consequences.** Matches how boutique inbound trips are actually planned. Adds a layer of grouping logic on top of the day-by-day scheduling, but keeps transfer counts realistic (not one transfer per lodging per night).

---

## ADR-05: Neon (managed Postgres, free tier) as the database

**Context.** The project needs a real relational database for a $0 portfolio deployment, with no infrastructure to manage.

**Decision.** Neon, created manually via its dashboard (no MCP integration for Neon exists). Connection string stored as `DATABASE_URL`, never committed.

**Consequences.** Zero infra cost and management overhead; serverless-friendly (works well with Vercel functions). Trade-off: manual setup step outside of tooling, and Neon's free tier has cold-start latency and storage/compute limits — acceptable for a portfolio demo, not for production scale.

---

## ADR-06: Flat 30% markup on provider net rates (`MARKUP_RATE = 0.30`)

**Context.** Rumbo's business model is a markup on what it pays local providers. The client never sees the provider's net rate; the provider never sees the client's price.

**Decision.** A single flat constant, `MARKUP_RATE = 0.30`, applied uniformly via `applyMarkup()` (`project/src/lib/pricing`), never hardcoded inline anywhere pricing is computed. Client budget validation always uses the marked-up price.

**Consequences.** Simple, auditable, and easy to change in one place. A real operator might vary markup by category, provider, or season — deliberately out of scope here to keep the pricing model legible for the demo.

---

## ADR-07: Availability's *background occupancy* is a deterministic function, not a stored table

**Context.** The system needs a plausible notion of "how busy is this provider/slot" without hand-authoring a huge availability table or paying to store one.

**Decision.** `backgroundOccupancy()` computes occupancy on the fly from provider popularity + day/hour + a fixed world seed, using an FNV-1a hash for determinism (no `Math.random()` anywhere in the availability layer).

**Consequences.** Reproducible runs, a tiny database, and no availability-table maintenance. The trade-off is that "occupancy" is a plausible simulation, not a real inventory feed — acknowledged in the production-honesty notes.

---

## ADR-08: Per-request provider confirmation lives in an ephemeral cache, not the database

**Context.** A client's specific availability request (this provider, this date, this party size) is transient — it only matters until the client either books within the hold window or the proposals expire.

**Decision.** Confirmations and the assembled proposals live in a temporary cache (`proposal_cache` table, treated as ephemeral via `expires_at`, not a permanent booking record) with a 15-minute hold that starts when the client *views* the proposals page, not when the email is sent. Only a completed purchase materializes real rows (`orders`, `order_items`).

**Consequences.** The database stays clean of speculative/expired holds. Requires the app to treat "expired" as a first-class read-time state rather than relying on a cleanup job — deliberately not cron-based (there is no scheduled cleanup).

---

## ADR-09: Payment is simulated — no Stripe, no data collection

**Context.** This is a portfolio exercise; a real payment integration brings PCI/compliance scope, account linking, and legal requirements that are out of scope for the exercise's purpose.

**Decision.** "Book this trip" is a single button that calls `confirmAndPay()`, materializes the order, and shows a confirmation screen. No card data, no external gateway, no data collected.

**Consequences.** The purchase flow is fully demonstrable end-to-end without any real financial risk or compliance burden. Explicitly documented as out of scope for a production build (would require Stripe + legal + account linking).

---

## ADR-10: No scalability or concurrency design — by design

**Context.** The system is a business-logic and technical-demonstration exercise, not a product being built for real traffic.

**Decision.** No load balancing, no queueing beyond simple async patterns, no concurrency control beyond what Postgres transactions give for free (e.g. the order-materialization transaction in `confirmAndPay`). Serverless (Vercel Hobby) is chosen for cost, not scale.

**Consequences.** Keeps the build focused on the parts that matter for the demonstration (engine correctness, business modeling, Node/TS craft). A real production deployment would need to revisit infrastructure, concurrency, and persistence from scratch — stated explicitly in the README so it reads as a deliberate scope boundary, not an oversight.

---

## ADR-11: Provider portal instead of WhatsApp / informal channels

**Context.** In the real target market, informal providers are often coordinated over WhatsApp. That's not a structured, auditable channel.

**Decision.** Build a dedicated (simulated) provider portal — a web page standing in for what would be a mobile app in production — where providers see pending requests (with their net rate) and confirm or decline. Every response is captured as system data (`provider_responses`), not a chat message.

**Consequences.** Provider confirmation becomes structured, queryable data instead of unstructured chat history, which is what a system that has to reason about availability actually needs. The trade-off (adoption friction of a portal vs. a channel providers already use) is a real business consideration but is explicitly excluded from this project's documentation per the client's instruction.
