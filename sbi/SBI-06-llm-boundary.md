# SBI-06 · LLM boundary: constraints + personalization

> **Model:** Sonnet 4.6, low effort.
> **Depends on:** SBI-02 (types), SBI-05 (engine consumes constraints + weights).
> **Objective:** Implement the narrow, fail-safe LLM layer. The LLM interprets the client's free text; deterministic code decides everything else. Weights are derived by CODE (profiles), not the LLM.

---

## Principle (the project's thesis, in code)
- **Hard data** (dates, flights, travelers, budget) never touches the LLM — it comes structured from the form.
- **Dropdowns** (interests, pace, mornings, group composition, lodging tier) map to weights and interest-match by DETERMINISTIC code.
- **The one free-text field** is the ONLY LLM input. The LLM produces:
  1. **Extra hard constraints** the dropdowns didn't ask (dietary, mobility) → real filters the engine applies.
  2. **Personalization considerations** → cross-referenced (RAG) against the selected providers' `provider_personalization` answers → concrete instructions sent to providers.
- The LLM NEVER sets scoring weights, decides availability, prices, or feasibility.
- Everything the LLM returns is **validated by Zod**; on failure, fall back to safe defaults (empty constraints, no personalization) and the engine runs on dropdowns alone. **Additive, not critical.**

## What to produce

### 1. Weight derivation (DETERMINISTIC — no LLM) in `project/src/lib/llm/weights.ts` (or `lib/engine/weights.ts`)
Four base profiles with pre-set weights (they must each sum to 1):
```
Relaxed    → pace 0.30, breathing 0.25, interest 0.25, transfer 0.15, variety 0.05
Explorer   → variety 0.30, interest 0.25, transfer 0.20, pace 0.15, breathing 0.10
Focused    → interest 0.40, transfer 0.20, pace 0.20, breathing 0.10, variety 0.10
Comfortable→ transfer 0.30, breathing 0.25, pace 0.20, interest 0.20, variety 0.05
```
- The `pace` dropdown (and/or interests) selects the profile.
- Other specific choices adjust the base (e.g. "hate long drives" → +transfer), then **normalize to sum 1**.
- `interest match` content (which categories count) comes directly from the interest dropdowns — separate from the metric's weight.
- (These numbers are a starting calibration; keep them in one place so they're easy to tune. Do not overthink — portfolio scope.)

### 2. LLM constraint + personalization extraction in `project/src/lib/llm/`
Call DeepSeek (`deepseek-v4-flash`, key from `DEEPSEEK_API_KEY`). Prompt it to return ONLY structured JSON (no prose, no markdown fences) with this shape, then parse + Zod-validate:
```ts
{
  extra_hard_constraints: Array<{ type: 'dietary' | 'mobility'; value: string }>,
  personalization_notes: string[]   // e.g. ["anniversary", "first_time_visitor", "avoid_touristy"]
}
```
- Define a Zod schema for exactly this. On parse/validation failure → return `{ extra_hard_constraints: [], personalization_notes: [] }` (safe default).
- The prompt receives: the free text, plus context of the catalog's available categories/flags and the dropdown selections (so it doesn't duplicate what's already structured).
- **Rule:** the LLM may only ADD hard constraints and personalization notes. It may NOT override explicit dropdown choices. Dropdowns win.

### 3. Personalization layer (RAG over a tiny controlled corpus)
After the engine selects an itinerary's providers, for each selected provider cross-reference `personalization_notes` against that provider's `provider_personalization` row and produce concrete instructions (e.g. anniversary + a provider that offers a private table → "Prepare private table; couple celebrating anniversary"). Corpus is ~25 providers × 3–4 lines — small and controlled, so **pass the relevant provider's capabilities directly in the prompt** rather than standing up a vector store (avoids infra on $0). Output: a list of per-provider instruction strings attached to the order.

## Verification criteria
- Given free text like "anniversary, my wife is vegetarian, we love coffee, avoid touristy spots": the LLM layer yields a `dietary: vegetarian` hard constraint and personalization notes (anniversary, avoid_touristy), and never alters weights.
- Malformed/empty LLM output → safe defaults, engine still runs on dropdowns.
- Weight derivation is deterministic and sums to 1 for every profile + adjustment.
- Dropdown choices are never overridden by free text.

## Do NOT
- Do NOT let the LLM set weights, prices, availability, or feasibility.
- Do NOT skip Zod validation of LLM output.
- Do NOT stand up a vector database — direct prompt context is sufficient at this scale.

## Handoff notes to write in task_list.md
- The exact Zod schema for LLM output.
- The weight-profile function signature (engine SBI-05 imports it).
- The personalization output shape (attached to orders in SBI-07).
