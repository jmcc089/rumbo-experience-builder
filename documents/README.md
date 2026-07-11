# Rumbo

**Rumbo** is the internal coordination system of an invented boutique inbound tour operator based in El Salvador, selling multi-day experiences to United States travelers.

A client submits a single request — dates, travelers, budget, and a free-text description of how they picture their trip. Rumbo coordinates with local providers, then builds **3 complete, distinct multi-day itineraries** (activities, local transfers, meals, lodging), each valid against hard constraints and optimized against a weighted scoring model. The client picks one and completes a simulated payment.

**The core of the system is a temporal constraint-satisfaction + optimization engine written in application code — not a prompt.** The LLM has a deliberately narrow role (free-text constraint extraction and provider-instruction personalization); deterministic code has final say on validity, pricing, availability, and scoring.

---

## The three portals

1. **Client portal** — landing → intake → status → proposals → simulated payment. The primary, most polished surface.
2. **Provider portal** — inbox of availability requests, confirm/decline, shows the provider's own net rate (never the client price).
3. **Operator portal** — Rumbo's internal dashboard: requests, orders, provider response status, margin, and a manual repair-demo trigger.

## The pipeline, end to end

```
1. Client submits intake + email → request saved (status: building) → Email 1 sent.
2. Match filter (static catalog: category, zone, dates, price-with-markup ≤ budget).
3. Simulated availability: formal providers respond instantly; informal providers
   respond or don't (no response = discarded). Held in an ephemeral cache, not the DB.
4. CSP validation: transfers, operating hours, sunrise/tide dependencies, etc.
5. Scoring + assembly: build 3 deliberately distinct itineraries, final price (markup applied).
6. Email 2 sent — link to /proposals/{token}.
7. Client opens the link → 15-minute hold starts on view → picks one → simulated pay
   → order materialized to DB.
8. Email 3 sent — purchase confirmation.

Repair (post-booking): a disruption generator (weighted by provider reliability) can
knock out one piece of a paid itinerary; the same engine re-solves for that gap only,
with the rest of the trip held fixed. Triggered manually from the operator dashboard.
```

## Stack

| Layer | Choice |
|---|---|
| Language / runtime | Node.js + TypeScript (strict mode) |
| Framework | Next.js (App Router) |
| Database | Neon (Postgres, free tier) |
| Runtime validation | Zod (all external data, including LLM output) |
| LLM | DeepSeek (`deepseek-v4-flash`) — narrow role only |
| Email | Resend (3 transactional emails) |
| Deployment | Vercel (Hobby, $0) |

## Running locally

```bash
cd project
npm install
cp .env.example .env.local   # fill in real values, see below
npx tsx src/lib/db/migrate.ts   # create/update schema in your Neon DB
npx tsx src/seed/seed.ts        # load the seed catalog (truncates + reloads)
npm run dev                     # http://localhost:3000
```

### Environment variables (`project/.env.local`, never committed)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `DEEPSEEK_API_KEY` | DeepSeek API key (LLM boundary — constraint extraction + personalization) |
| `RESEND_API_KEY` | Resend API key (transactional email) |
| `APP_BASE_URL` | Base URL used to build proposal links in emails |

All four are optional at the code level in the sense that the app fails safe without them (no email sent, LLM falls back to deterministic defaults) — but `DATABASE_URL` is required for anything to actually run.

## Business model (load-bearing for the pricing logic)

- Rumbo charges a flat **30% markup** (`MARKUP_RATE = 0.30`, `project/src/lib/pricing`) on provider net rates.
- The client pays one all-in price; Rumbo keeps the difference.
- The client's budget is validated against the **marked-up price**, never the provider net cost.
- Providers only ever see their **net rate** — never the client price or the markup.

## Scope boundaries (deliberately out)

- International flights are context only (arrival/departure become day-1/final-day constraints) — not coordinable inventory.
- No real payment integration (no Stripe or any payment gateway).
- No real provider confirmation channel — the provider portal simulates it.
- No general post-sale service or complaints handling.
- No scalability, concurrency, or high-availability design.

## Production-honesty notes

- **Provider catalog:** in production this would come from real sourcing and onboarding; here it's a curated seed reflecting how a boutique inbound operator actually structures its network.
- **Provider communication:** in production this would be a real mobile app; here it's simulated via the web-based provider portal.
- **Payment:** real payment would require Stripe (or similar) integration, PCI scope, and legal review for account linking and refunds — explicitly out of scope here.
- **Contracts / penalties / force majeure** with providers exist in the real business's legal plane and are outside this build.
- **This project does not contemplate scalability or high concurrency by design.** It is a business-modeling and technical-demonstration exercise. A production deployment would require revisiting infrastructure, concurrency, and persistence choices from scratch.

## Naming note

"Rumbo" is used elsewhere in the travel industry; a real launch would require a trademark check. Fine as-is for portfolio scope.

## What's next (Assurance phase)

This README and the accompanying [ADR.md](ADR.md) and [SAD.md](SAD.md) are the Build-phase documentation base. The Assurance phase (separate from this Build package) will produce the full software architecture document, polish this README, and run a final end-to-end verification pass.
