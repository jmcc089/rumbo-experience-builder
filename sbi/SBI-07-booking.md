# SBI-07 · Booking state machine + cache + orders

> **Model:** Sonnet 4.6, low effort.
> **Depends on:** SBI-02 (schema), SBI-04 (availability), SBI-05 (engine).
> **Objective:** Implement the request→proposals→hold→pay→order flow, the ephemeral confirmation cache, and order materialization. Wire real-order consumption back into availability.

---

## Principle
- Per-request provider confirmations are **ephemeral** — a temporary hold, NOT permanent DB rows, with a 15-minute window.
- They **materialize to the DB (orders + order_items) only when the client pays**.
- Availability is instant vs on-request by provider type; a non-responding informal provider is discarded. (Confirmation resolution logic lives in SBI-04's `resolveConfirmation`.)

## State machine
```
available → held → paid → settled
              ↓
          (15 min expire)
              ↓
           released
```
- `available`: confirmed capacity, candidate for proposals.
- `held`: client is viewing proposals; the pieces of the shown itineraries are held. **The 15-min timer starts WHEN THE CLIENT OPENS the proposals link, not when the confirmation email is sent.**
- `paid`: client paid within the window → the chosen itinerary's pieces materialize into `orders` + `order_items` (status `paid`).
- `settled`: net payment to providers marked as settled ~3 business days later (a status only — no real banking logic).
- `released`: window expired without payment → held capacity freed.

> The hold is transactional over the WHOLE selected itinerary: all its pieces materialize together on pay, or all release together on expiry.

## What to produce (in `project/src/lib/booking/`)

1. **Ephemeral confirmation store** with per-entry expiry (a 15-min TTL). In $0 serverless there's no always-on Redis; implement as either (a) rows in a lightweight table marked temporary with an `expires_at` timestamp that are ignored/cleaned once expired, or (b) an equivalent TTL structure. Either is fine; document the choice. The point is: NOT a permanent booking, cleared/ignored on expiry.

2. **Request lifecycle service:**
   - `createRequest(intake)` → persists `client_requests` (status `building`), returns a non-guessable `token`.
   - `runPipeline(requestId)` → orchestrates: match filter → availability confirmation (SBI-04) → engine assemble (SBI-05) → personalization (SBI-06) → store the 3 proposals for retrieval by token → set status `proposals_ready`. (Triggers email 2 via SBI-08.)
   - `getProposals(token)` → returns the 3 proposals for the proposals page; **starts the 15-min hold on first open**.
   - `confirmAndPay(token, chosenItineraryId)` → within the window: materialize `orders` + `order_items`, set request `paid`, return confirmation (triggers email 3). Outside the window: return an expired result and set status `expired`.

3. **Wire real-order consumption into availability:** implement the `spotsConsumedByRealOrders(...)` term that SBI-04 stubbed, reading paid `order_items`.

## Verification criteria
- A created request gets a unique non-guessable token.
- Proposals are retrievable by token; the hold timer starts on first `getProposals`, not before.
- Paying within 15 min materializes orders + order_items; the same pieces then reduce availability for other requests.
- Letting the window expire releases the hold and sets status `expired`; the proposals link then shows expired state.
- Provider net prices are stored on `order_items` for settlement and never exposed on any client-facing path.

## Do NOT
- Do NOT store per-request confirmations as permanent bookings before payment.
- Do NOT start the 15-min timer when the email is sent — only when the client opens the proposals.
- Do NOT require any second provider confirmation at payment time (already confirmed at availability step).
- Do NOT expose provider net price or markup to the client path.

## Handoff notes to write in task_list.md
- The cache/TTL implementation choice (a or b) and where it lives.
- Exact service function signatures (the client-portal SBIs call these).
- How proposals are stored between pipeline run and retrieval by token.
