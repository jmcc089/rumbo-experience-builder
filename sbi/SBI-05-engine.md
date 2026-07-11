# SBI-05 · The engine: CSP + scoring (assembly + repair)

> **Model:** Sonnet 4.6, low effort. (This is the most important module — instructions are detailed so execution stays mechanical.)
> **Depends on:** SBI-02 (schema/types), SBI-04 (availability).
> **Objective:** Implement the temporal constraint-satisfaction + optimization engine in application code. One engine, two entry points (assembly, repair). This is the core that makes the project real backend logic, not an LLM wrapper.

---

## Principle
Two layers, in order:
1. **Validity (binary, hard constraints):** a candidate itinerary either satisfies ALL hard constraints or it does not exist.
2. **Quality (graded, weighted scoring):** among valid candidates, rank by a weighted sum of 5 normalized metrics; return the top-3 that are deliberately distinct.

The day is modeled as **continuous bounded time**. Days are chained via **lodging (multi-base)**.

---

## Inputs to the engine (the "problem")
A structured object containing:
- `slots`/`days`: the trip days to fill (assembly: all empty; repair: all fixed except one gap).
- `fixedPieces`: already-placed pieces (empty in assembly; everything except the gap in repair).
- `hardConstraints`: dates + flight times (day-1 start ≥ arrival_time, final day ends ≤ departure_time), budget (validated against **marked-up** price via `applyMarkup`), no-early-mornings (nothing before the configured hour, e.g. 09:00, if forbidden), dietary/mobility exclusions (from LLM — SBI-06), dependency rules (`sunrise_only`, `tide_dependent`).
- `weights`: the 5 scoring weights (from SBI-06's profile logic), summing to 1.
- `candidatePool`: experiences that passed the match filter AND confirmed availability (via SBI-04).
- `transferMatrix`, `lodging`.

## Hard constraints (validity layer) — an itinerary is INVALID if any fail
- A day's first activity starts before its allowed start (respecting arrival_time on day 1 and the no-early-mornings rule).
- Any activity runs past the day's operating window or an experience's `open_to`, or falls on a day the experience is closed (`open_days`).
- A transfer between consecutive pieces doesn't fit in the available time (use `transferMatrix` between the pieces' zones; account for lodging base at day start).
- A dependency is violated (`sunrise_only` scheduled outside sunrise; `tide_dependent` outside its window; ignore weather in v1 or treat as soft).
- The marked-up total exceeds `budget_total`.
- A piece has no availability for the group size on that date/slot (SBI-04).
- Final day activities don't leave enough time before `departure_time` + transfer to departure point.

## Quality layer — 5 metrics, each normalized to [0,1]
1. **Transfer efficiency** = `1 − (totalTransferMinutes / TOLERABLE_MAX)`. Less road time is better.
2. **Interest match** = how well chosen experiences' categories align with the client's interest selections (from dropdowns). Higher when the itinerary is dense in requested categories.
3. **Pace** = closeness of actual daily activity density to the client's requested pace (relaxed/balanced/intense). Penalize distance from target.
4. **Breathing room** = slack between activities (buffers, not-packed days). Distinct from pace: pace = how many; breathing room = how tight.
5. **Variety** = diversity of experience types across the trip (avoid monotony even within a favored interest).

**Score** = Σ (weight_i × metric_i). Deterministic, in [0,1]. Every displayed number rounded.

The engine must be able to expose the **per-metric breakdown** for each itinerary (for the proposals UI and for justification).

## Candidate generation & selection (concrete approach)
- Model as CSP over the day sequence. Generate valid candidate itineraries via constructive placement (greedy by score) + local search refinement (swap/move/replace pieces, keep improvements). Constraint checks prune invalid placements early.
- This is a small problem (≤~10 zones, 5–8 day trips, ~25–30 experiences) — no industrial solver needed. Keep it readable and testable.
- **Top-3 distinct:** after selecting the best valid itinerary, apply a **similarity penalty** so the 2nd and 3rd chosen differ meaningfully (differ in ≥ N core experiences, or have distinct character). Do not return three trivial variants of the same skeleton.

## Multi-base lodging
- Group consecutive days by zone/region into blocks; assign one lodging base per block.
- The base fixes the next morning's start point; the first transfer of a day originates from the base's zone.
- Changing base incurs a transfer (time) and its own nightly cost (money, into budget).

## Two entry points
```
assemble(problem) → { proposals: Itinerary[3], scored: {...breakdowns} }  // all days empty → fill
repair(paidItinerary, gapPieceId, seed) → { replacement: Itinerary | null, reason?: string }
```
- `repair` fixes everything except the disrupted piece and re-solves that one gap with the same validity + scoring machinery (quality provides the "north" for choosing the best replacement). Returns `null` + reason if no valid replacement exists.

## Output shape
- `assemble` returns exactly 3 valid, distinct itineraries, each with: ordered days (pieces with times, transfers, meals, nightly lodging), total net, total client price (marked up), and the per-metric score breakdown.
- If fewer than 3 valid itineraries exist, return what exists and a reason for the shortfall.

## Verification criteria
- Given a seeded problem, `assemble` returns valid itineraries only (write a validity checker used in tests).
- No returned itinerary violates any hard constraint (transfer feasibility, windows, budget, dependencies, availability).
- The 3 proposals are measurably distinct (similarity check passes).
- Scores are deterministic and reproducible for the same input + seed.
- `repair` returns a valid replacement for a solvable gap and `null`+reason for an unsolvable one.
- Budget is validated against the marked-up price (a trip whose NET fits but whose MARKED-UP price exceeds budget is correctly rejected).

## Do NOT
- Do NOT use the LLM anywhere in this module. The engine is pure deterministic code.
- Do NOT put availability logic here — import it from SBI-04.
- Do NOT hardcode the markup — import `MARKUP_RATE`/`applyMarkup` from `lib/pricing`.
- Do NOT return invalid itineraries "ranked low" — invalid means excluded entirely.

## Handoff notes to write in task_list.md
- Exact exported signatures of `assemble` and `repair`.
- The `TOLERABLE_MAX` transfer constant and any other tunables, with chosen values.
- Where the per-metric breakdown is exposed (the proposals UI in SBI-10 needs it).
- The similarity/distinctness rule as implemented.
