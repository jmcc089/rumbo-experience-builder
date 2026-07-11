# SBI-10 · Client portal — status + proposals + payment

> **⚠️ MODEL: BUILD WITH OPUS, not Sonnet low.** This is the star screen — the richest, most important page in the project.
> **Depends on:** SBI-05 (engine output), SBI-07 (lifecycle + token), SBI-08 (emails), SBI-09 (design tokens).
> **Objective:** Build the status page, the proposals page (the star), and the simulated payment.

---

## Design system
Same as SBI-09 (cobalt `#0F47AF`, navy `#1E2A44`, off-white `#FBFCFE`, pale blue `#E9EEF6`, gold `#E0A44A`; logo "Rumbo." cobalt + gold dot; serif headings, clean sans body; airline-clean; English). Keep visual consistency with SBI-09's established tokens.

## Pages

### 1. Status page
- After intake submit (and reachable generally), a simple state: "We're building your experience. We'll email you the moment it's ready." Calm, on-brand.
- Mechanism: status is pollable (simple polling or a refresh reads status from DB). **No WebSockets/SSE** — they don't fit $0 serverless. The real reengagement is Email 2.

### 2. Proposals page (THE STAR) — route `/proposals/{token}`
- Accessed via the non-guessable token in the URL (from Email 2). No login. On first open, `getProposals(token)` **starts the 15-min hold** (SBI-07).
- **Two-level hierarchy:**
  - **Top: the 3 options as comparable cards.** Each: a character name (e.g. "Volcanoes & Coffee", "Coast & Colonial", "The Full Circuit"), a one-line summary of what makes it distinct, interest tags, and the **final all-in client price** (marked up). One card is selected/highlighted (cobalt 2px border + a small "Selected" badge). Cards are clickable to switch the detail below.
  - **Below: the selected itinerary, day by day.** A vertical timeline. Each day shows: the main activity/activities (with icons), transfers (with time), meals, and where they sleep that night (the lodging anchor). Long trips may collapse middle days ("Days 4–7 · …") but all days must be viewable. Optionally a small photo per day (placeholder).
- **Hold indicator:** a subtle "Held for you · MM:SS left to choose" using gold, framed as gentle urgency ("held for you"), not aggressive pressure. Counts down the 15-min window.
- **Price summary + CTA:** what's included, the total (marked-up) price, a reassurance line ("all in · nothing else to pay"), and a **gold "Book this trip"** button (dark navy text).
- Show the client price only — **never** the provider net or the markup.

### 3. Payment (simulated)
- Clicking "Book this trip" → **no data collected, no Stripe**. Calls `confirmAndPay(token, chosenItineraryId)` (SBI-07).
- Within the window: show a clean "Payment complete / Booking confirmed" state, trigger Email 3 (SBI-08). Prefer a confident real-looking confirmation ("Booking confirmed") with a small, discreet demo disclaimer — not a button that says "this doesn't work".
- If the window expired: show an "these options have expired — start a new request" state (status `expired`).

## Behavior
- The proposals detail must reflect the engine output faithfully (days, transfers, meals, lodging, price). If the engine exposes per-metric score breakdowns, they may be surfaced subtly (optional), but the client view leads with the human-readable itinerary, not raw scores.
- All money shown = marked-up client price.

## Verification criteria
- `/proposals/{token}` renders 3 distinct itineraries with day-by-day detail and correct all-in prices.
- Opening the page starts the 15-min hold; the countdown reflects it.
- Selecting a card switches the detailed itinerary below.
- "Book this trip" completes a simulated payment (no data collected), shows confirmation, triggers Email 3, materializes the order.
- Expired window shows the expired state.
- No provider net price or markup is ever visible.

## Do NOT
- Do NOT use WebSockets/SSE for status.
- Do NOT collect real payment data or integrate Stripe.
- Do NOT start the hold timer before the client opens the page.
- Do NOT reveal net prices or markup.

## Handoff notes to write in task_list.md
- The proposals route + token handling as built.
- How the itinerary JSON is shaped for the UI (matches SBI-05 output).
- The simulated payment confirmation flow as built.
