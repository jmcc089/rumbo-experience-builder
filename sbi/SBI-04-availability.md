# SBI-04 · Availability & occupancy functions

> **Model:** Sonnet 4.6, low effort.
> **Depends on:** SBI-02 (schema), SBI-03 (seed provides provider attributes).
> **Objective:** Implement availability as DETERMINISTIC CODE (not stored data). Two things: background occupancy (a pure function) and effective-availability computation.

---

## Principle
Availability is NOT a table. It is derived from static provider attributes on the fly, deterministically (same seed → same world, reproducible tests). This keeps Neon small and makes the world feel "alive" without maintenance.

## What to produce (in `project/src/lib/availability/`)

1. **Background occupancy function** — pure, deterministic:
   ```
   backgroundOccupancy(experienceId, date, slotStart, seed) → number in [0,1]
   ```
   Derivation (not random noise — weighted by real attributes):
   - Base level from the provider's `base_popularity` (popular → higher occupancy).
   - Modulated by day-of-week (weekends busier) and time-of-day (sunrise/peak slots more contested).
   - Deterministic: seed + inputs always yield the same value. Use a stable hash of `(experienceId, date, slot, seed)` to produce the pseudo-random component so results are reproducible.

2. **Effective availability**:
   ```
   effectiveSpots(experienceId, date, slot, travelers, seed) → { available: boolean, spotsLeft: number }
   ```
   Where:
   ```
   spotsLeft = capacity_per_slot
             − round(capacity_per_slot × backgroundOccupancy(...))
             − spotsConsumedByRealOrders(...)   // from order_items in DB (SBI-07)
   available = spotsLeft ≥ travelers
   ```
   Real orders come from the DB (paid orders). Until SBI-07 exists, the real-orders term can default to 0 behind a function boundary, then wired in.

3. **Provider confirmation resolution (simulated)** — models the per-request "ask the provider" step used by the pipeline (step 3):
   ```
   resolveConfirmation(providerId, experienceId, date, slot, travelers, seed) → 'confirmed' | 'no_capacity' | 'no_response'
   ```
   Behavior by provider type:
   - `formal` (`confirmation_mode: instant`): returns `confirmed` if `effectiveSpots.available`, else `no_capacity`. Never `no_response`.
   - `informal` (`confirmation_mode: on_request`): may return `no_response` with a probability derived from `reliability_score` (lower reliability → more likely no response); otherwise behaves like formal (`confirmed`/`no_capacity`). `no_response` ⇒ the piece is discarded from candidates.

   Deterministic given the seed.

## Notes
- A `SEED` constant (or env-config) governs the whole simulated world. Document it. Default to a fixed value so demos are reproducible; allow override for variety.
- These functions are the ONLY source of availability truth at assembly time, combined with real orders from the DB.

## Verification criteria
- `backgroundOccupancy` returns the same value for the same inputs across runs (determinism test).
- A popular provider yields higher occupancy than a niche one for the same date/slot.
- `effectiveSpots` correctly subtracts occupancy and (stubbed) real orders.
- `resolveConfirmation` never returns `no_response` for a formal provider, and can return it for a low-reliability informal provider.

## Do NOT
- Do NOT persist occupancy to the DB.
- Do NOT let the LLM anywhere near these functions — this is pure deterministic code.
- Do NOT use non-deterministic `Math.random()` without seeding — reproducibility is required.

## Handoff notes to write in task_list.md
- The exact exported function signatures (engine SBI-05 imports these).
- The `SEED` constant name/location and its default value.
- How real-order consumption is wired (stub now, connected in SBI-07).
