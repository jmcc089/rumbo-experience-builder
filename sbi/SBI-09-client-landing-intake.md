# SBI-09 · Client portal — landing + intake

> **⚠️ MODEL: BUILD WITH OPUS, not Sonnet low.** Design execution needs the stronger model.
> **Depends on:** SBI-01 (scaffold), SBI-06 (weight/constraint layer consumes intake).
> **Objective:** Build the client-facing landing + the 3-step intake form. This is the primary, most-polished surface — the first impression.

---

## Design system (embedded — Claude Code has no memory of prior design sessions)

**Direction:** boutique-premium, **airline-clean**. A full presentation hero up top (impact, minimal), then the form directly below. Lots of air, few elements per screen, typography-forward. Think premium airline / boutique travel splash — NOT a generic SaaS landing, NOT a long multi-section marketing scroll.

**Palette (cobalt + gold, cool neutrals — NO warm beige):**
| Token | Hex | Use |
|---|---|---|
| Cobalt | `#0F47AF` | Primary — header, logo, headings |
| Navy ink | `#1E2A44` | Body text |
| Off-white | `#FBFCFE` | Page background |
| Pale blue | `#E9EEF6` | Soft surfaces / cards |
| Gold | `#E0A44A` | Accent — CTAs, fine details |

- Gold = accent only, never large fills. Text on gold = dark navy `#3a2a08`, never white.
- **Logo "Rumbo."** — "Rumbo" in cobalt, dot in gold on light backgrounds; all-white on the cobalt header. Logo font: **Sarina** (Google Fonts, logo only).
- Headings: sober serif (Cormorant Garamond or similar). Body/UI: clean sans. **NOT Inter/Roboto/Arial/system as the display face.**

**Anti-generic rules (embedded — no external skill required):**
- No generic AI aesthetics: no Inter/Roboto as display, no purple-on-white gradients, no default 3-card SaaS grid as the hero.
- Commit to the airline-premium direction. Take deliberate, specific choices.
- Match complexity to a refined/minimal vision: restraint, precise spacing, subtle detail — not heavy effects.
- Real photography of El Salvador is the intended hero imagery; use tasteful solid/pale-blue placeholders where photos will go, clearly swappable.

> If the frontend-design skill is installed in `.claude/skills/`, let it assist — but these rules make this SBI self-sufficient without it. Pass any available mockups from the design sessions as visual reference.

**Language:** all UI copy in **English** (US client).

## Structure

### Landing (airline-clean)
- **Header:** cobalt band, white "Rumbo." logo (gold dot), minimal nav (How it works · Experiences · Sign in — non-functional links are fine).
- **Hero:** full-width presentation. Serif headline "All of El Salvador, none of the planning". Subline "Tell us how you picture your trip. We build every day of it — you just show up and live it." A single primary CTA. Intended background: a real ES photo (placeholder for now). Small "Start below" cue.
- **Directly below the hero: the intake form.** No long marketing sections in between. (One slim reassurance line is fine: "No payment until you approve an itinerary.")

### Intake — 3 progressive steps (with a progress indicator)
**Step 1 — The basics (hard data, deterministic, never touches the LLM):**
- Arrival date, Departure date (date pickers)
- Arrival flight time, Departure flight time (time pickers) — day-1 and final-day constraints
- Travelers (number)
- Total budget, USD (this is validated later against the marked-up price)

**Step 2 — Preferences (dropdowns/selects → map to weights + interest match):**
- Interests (multi-select): Nature & adventure · Food & gastronomy · Culture & history · Beach & relax · Coffee & landscape
- Pace (single-select): Relaxed · Balanced · Intense
- Mornings (toggle): Fine to wake early for special activities · Prefer no early mornings
- Group composition (single-select): Couple · Family with kids · Friends · Solo
- Lodging level (single-select): Budget · Comfort · Premium

**Step 3 — Your voice (the ONE free-text field → the only LLM input):**
- A single textarea with a warm, emotional prompt. Use this copy:
  > "Tell us what matters to you. Whether it's a special occasion, a passion, a dietary preference, or something you'd rather avoid — we'd love to shape every detail around you."
- Placeholder with a concrete example, e.g.: "We're celebrating our anniversary, we love specialty coffee, my wife is vegetarian, and we'd rather skip the very touristy spots."
- **Email field** here (required — the return channel; no login).

**Submit:** on submit → call `createRequest` (SBI-07), show the "we're building your experience, we'll email you" state, and trigger Email 1 (SBI-08).

## Behavior
- No login anywhere.
- Progressive reveal between steps (a transition is nice-to-have, not required); all steps must still be reachable and submittable.
- Hard-data fields are plain controls; only the free text is LLM-bound.

## Verification criteria
- Landing renders in the airline-clean direction with the exact palette and logo treatment.
- The 3-step intake collects every field above; email is required.
- Submitting creates a request (status `building`) and shows the building state.
- No generic-AI look (no Inter/Roboto display, no purple gradients, no default SaaS card hero).
- All copy is in English.

## Do NOT
- Do NOT collect payment info anywhere.
- Do NOT send hard data (dates/budget/etc.) through the LLM — those are structured fields.
- Do NOT add login/signup.

## Handoff notes to write in task_list.md
- The intake payload shape passed to `createRequest` (SBI-10 and SBI-06 rely on it).
- Any component/style tokens established, so SBI-10/11/12 stay consistent.
