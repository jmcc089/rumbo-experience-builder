# SBI-13 · Repair mode + disruption generator

> **Model:** Sonnet 4.6, low effort.
> **Depends on:** SBI-05 (engine `repair`), SBI-07 (orders/order_items).
> **Objective:** Wire the post-booking repair flow: a disruption knocks out a piece of a PAID itinerary, and the same engine re-solves that gap with the rest fixed. This is what makes "one engine, two uses" real.

---

## Principle
Repair lives AFTER booking. A paid itinerary can lose a piece (provider falls through). The cause (force majeure vs no-show) is irrelevant to the engine — it only needs: there's a gap, the rest is fixed, find the best valid replacement. Redundancy in the seed (SBI-03) is what makes replacements possible.

In $0 serverless there is no always-on monitor — repair is an **action triggered** (by the operator, or by the disruption generator in the demo), not a daemon.

## What to produce

1. **Disruption generator** (`project/src/lib/booking/` or `.../repair/`):
   - Given a paid order, select a piece to disrupt with probability weighted by the provider's `reliability_score` (informal/low-reliability → more likely). Deterministic given the seed.
   - Mark the affected `order_items` row `disrupted`.

2. **Repair invocation:**
   - Call the engine's `repair(paidItinerary, gapPieceId, seed)` (SBI-05) to find the best valid replacement for the single gap, holding all other pieces fixed.
   - On success: update the order's itinerary JSON + `order_items` (old piece `replaced`, new piece added `booked`). Recompute totals if the replacement's price differs (keep it consistent; document how price differences are handled — e.g. absorbed or reflected).
   - On failure (no valid replacement): surface a clear reason (this is where redundancy matters; a good seed should make this rare).

3. **Trigger surface (demo):**
   - A way to invoke a disruption + repair for a given paid order — e.g. an operator-dashboard action (SBI-12) or a simple endpoint. Keep it explicit and demo-able. This does not need to be a background job.

## Verification criteria
- Disrupting a piece marks the order_item `disrupted` and is deterministic for a given seed.
- `repair` returns a valid replacement that violates no hard constraint and keeps the rest of the itinerary fixed.
- The order + order_items reflect the replacement (`replaced` / new `booked`).
- An unsolvable gap surfaces a clear reason (and is rare given seed redundancy).
- Informal/low-reliability providers are disrupted more often than formal/high-reliability ones.

## Do NOT
- Do NOT build an always-on monitor — repair is triggered, not a daemon.
- Do NOT re-solve the whole itinerary — repair fixes ONE gap with the rest fixed.
- Do NOT model contract/penalty/force-majeure logic in code — that's the legal plane, out of the build (documented in the SAD).

## Handoff notes to write in task_list.md
- The disruption generator + repair invocation signatures.
- How price differences on replacement are handled.
- The demo trigger surface (endpoint or dashboard action).
