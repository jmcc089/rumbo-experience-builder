# SBI-12 · Operator dashboard

> **⚠️ MODEL: BUILD WITH OPUS, not Sonnet low.**
> **Depends on:** SBI-07 (orders, requests, lifecycle).
> **Objective:** Build Rumbo's own dashboard — the operator's view of the business. Content is at the builder's discretion but it must be complete and credible.

---

## Design system
Same brand tokens (cobalt/navy/off-white/pale-blue/gold; "Rumbo." logo; serif headings/clean sans; English). **Internal tool tone** — clean, functional, dashboard-appropriate. It may be denser than the client portal (it's a tool), but stays brand-consistent.

## What it shows (credible operator view — closes the loop in the demo)
- **Metric cards** across the top: active requests, awaiting client, confirmed trips, and **margin this month** (accumulated markup — this is where the operator sees the business working). This margin figure is internal-only.
- **Recent requests table:** client, dates, value, status (`building` / `proposals sent` / `paid`) with status pills.
- **Provider response panel:** formal vs informal responding/pending counts (ties to the modeled provider axis).

The exact widgets are flexible — the goal is a complete, believable operations dashboard that demonstrates the ticket closes end to end (requests come in → become paid orders).

## Verification criteria
- Metric cards render with real values derived from the DB (requests, orders, computed margin).
- The requests table shows status states correctly.
- Provider response panel renders.
- Brand-consistent, internal-tool tone.

## Do NOT
- Do NOT over-market it; it's an internal dashboard.
- Do NOT expose anything that breaks the model (margin is fine here — it's the operator's own view; but this view must be separate from client/provider surfaces).

## Handoff notes to write in task_list.md
- Which metrics/queries were implemented.
- Any shared components reused.
