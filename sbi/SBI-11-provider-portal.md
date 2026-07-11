# SBI-11 · Provider portal

> **⚠️ MODEL: BUILD WITH OPUS, not Sonnet low.**
> **Depends on:** SBI-04 (confirmation resolution), SBI-07 (lifecycle).
> **Objective:** Build the provider-facing portal where an incoming availability request is shown and the provider confirms or declines. This closes the loop (in real life a mobile app; here a web page).

---

## Design system
Same brand (cobalt `#0F47AF`, navy `#1E2A44`, off-white `#FBFCFE`, pale blue `#E9EEF6`, gold `#E0A44A`; "Rumbo." logo; serif headings/clean sans; English). **Internal tool tone:** coherent with the brand but cleaner/more functional than the client portal — this is a tool, not a marketing surface. Less personality, more clarity.

## The essential screen (the point of this portal)
A **request inbox** (delivery-app style: a request comes in, provider sees it and acts):
- **Incoming request detail** — the important part. Show: date + time, number of people, the service requested, and **"You'll be paid $X"** = the provider **NET rate** (in a positive color, e.g. a green). A **response countdown** (like a delivery courier's accept window).
- **Two actions:** "Yes, we have space" (confirm) / "Can't take it" (decline). No response within the window = treated as no-response (discarded) by the system.
- **Recent history** (accepted/declined past requests) so it feels complete.

## Business rule (must hold)
- The provider sees ONLY their net rate — **never** the client's marked-up price and never the markup. This is load-bearing for the model.

## Behavior
- Confirm/decline feeds the availability confirmation step (SBI-04 `resolveConfirmation` models the simulated behavior; this portal is the human-visible surface of it for the demo).
- Formal vs informal difference is conceptual here; the portal itself just shows the request and captures the response.
- No login required for the demo (a simple provider selector/context is acceptable to pick which provider you're acting as).

## Verification criteria
- The incoming request shows date, time, people, service, and the NET rate (never client price).
- Accept / decline actions work and are reflected in state.
- A response countdown is present.
- Recent history renders.
- Internal-tool tone: clean, brand-consistent, not marketing-heavy.

## Do NOT
- Do NOT show the client price or the markup anywhere in this portal.
- Do NOT use WhatsApp or any external messaging — this portal IS the channel.
- Do NOT over-design it like the client landing; keep it a clean tool.

## Handoff notes to write in task_list.md
- How a provider context is selected for the demo (no login).
- Any shared components reused from SBI-09/10.
