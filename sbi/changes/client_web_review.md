# Client web — design review & change list

> **Purpose:** A holding place for design tweaks to the **client portal** (landing + intake,
> built in SBI-09) that the operator wants to revisit **later**. This is NOT a blocker for
> advancing the build — the current pages pass their SBI-09 checkpoint. Treat everything here
> as design-only polish to apply in a dedicated pass (before Assurance / SBI-14 deploy).
>
> **Status:** OPEN — awaiting the operator's specific notes.
> **Scope:** visual/UX only. Do not change the intake payload shape, the enum mappings, or the
> pipeline wiring documented in `task_list.md` (SBI-09 notes) without flagging it.

---

## How to use this file
When you know what you want changed, add a bullet under **Desired changes** below. Be as loose
as you like ("hero feels too plain", "form is too long", a screenshot, a reference link) — a later
session will turn each bullet into a concrete edit. Keep the **Current state** section as the
reference for what exists today.

---

## Desired changes (fill this in)

> _Add your notes here — one bullet per thing you'd change. Rough is fine._

- (element / page) — what feels off → what you'd prefer
-
-

---

## Current state (reference — what exists today, from SBI-09)

**Files** (all under `project/src/app/`):
- `layout.tsx` — fonts: **Sarina** (logo), **Cormorant Garamond** (headings), **Mulish** (body/UI).
- `globals.css` — design tokens (the palette + type + radii live here; shared by all portals).
- `components/Header.tsx` (+ `.module.css`) — cobalt sticky header, white "Rumbo." wordmark, nav.
- `components/IntakeForm.tsx` (+ `.module.css`) — 3-step form + progress bar + "building" state.
- `page.tsx` (+ `page.module.css`) — landing: header → hero → intake → footer.

**Landing / hero**
- Full-bleed **cobalt→navy gradient** (placeholder) with a soft gold radial glow top-right and a
  thin gold hairline along the bottom edge. Intended to be swapped for a **real El Salvador photo**.
- Eyebrow "BOUTIQUE EXPERIENCES · EL SALVADOR", serif headline "All of El Salvador, none of the
  planning", sans subline, one **gold CTA** ("Start planning"), reassurance line, "Start below" cue.

**Intake form (below hero)**
- White card on off-white, centered, max-width ~760px, soft shadow + hairline border.
- 3 steps: **The basics** (dates/times/travelers/budget) · **Preferences** (interest chips +
  segmented pace/group/lodging + stacked morning options) · **Your voice** (free-text + email).
- Progress indicator: done = gold ✓, active = cobalt, todo = grey. Gold primary buttons.
- Post-submit: a centered "We're building your experience" panel.

**Design system tokens (in `globals.css`)**
| Token | Hex | Use |
|---|---|---|
| `--cobalt` | `#0F47AF` | header, logo, headings, active states |
| `--cobalt-deep` | `#0b3688` | gradient / hover |
| `--navy` | `#1E2A44` | body text |
| `--offwhite` | `#FBFCFE` | page background |
| `--pale` | `#E9EEF6` | soft surfaces / fills |
| `--pale-line` | `#d7e0ee` | hairline borders |
| `--gold` | `#E0A44A` | accent / CTAs |
| `--gold-deep` | `#c98d31` | gold hover |
| `--on-gold` | `#3a2a08` | text on gold |
| `--muted` | `#5b6577` | secondary text |

**Brand rules to keep in mind while changing things** (from SBI-00 §6):
- Airline-clean, boutique-premium. Lots of air, few elements per screen, typography-forward.
- Gold is an **accent, not a fill**; text on gold is dark navy, never white.
- No generic-AI look: no Inter/Roboto/Arial as display, no purple gradients, no default SaaS grid.
- Logo font Sarina is **logo-only**. Headings serif, body clean sans.

---

## Notes for whoever applies these later
- Editing tokens in `globals.css` cascades to the intake form and any future client pages — cheapest
  place to shift the whole palette/feel.
- The hero background is the single biggest lever: dropping in a real photo (with a navy overlay for
  white-text contrast) will change the whole first impression. Placeholder is clearly marked in
  `page.tsx` / `page.module.css`.
- Keep changes visual. Anything touching the form's data (fields, payload, validation) is engine-facing —
  see `task_list.md` → "SBI-09 notes" before altering.
