# SBI-08 · Email layer (Resend, 3 templates)

> **Model:** Sonnet 4.6, low effort. (Template visual polish is light; brand colors embedded below.)
> **Depends on:** SBI-02 (client_requests has email + token), SBI-07 (lifecycle triggers).
> **Objective:** Implement the 3 transactional emails via Resend. Email is the return channel (no login) — it's how the client comes back to the flow.

---

## The 3 emails (roles are distinct — do not blur them)

### Email 1 — plain acknowledgment
- **Trigger:** on intake submit (request created, status `building`).
- **Content:** simple, reassuring. "We received your request and we're putting your trip together. We'll email you the moment your options are ready." NO link, NO action. Its only job is to confirm the on-site action was real.

### Email 2 — the reengagement (most important)
- **Trigger:** when the pipeline finishes and proposals are ready (`proposals_ready`).
- **Content:** carries the **link to `{APP_BASE_URL}/proposals/{token}`** where the 3 proposals wait, each with a book button. Warm, inviting. This is what brings the client back.

### Email 3 — purchase confirmation
- **Trigger:** when the client pays (`confirmAndPay` succeeds).
- **Content:** the purchase details — the chosen itinerary summary (days, what's included), the total paid. A clean confirmation/receipt.

## Copy language & voice
- **All emails in English** (US client).
- Voice: warm, premium-boutique — matches the site. Not corporate filler.

## Brand in templates (embedded — keep consistent with the site)
- Header band: cobalt `#0F47AF`, logo "Rumbo." (Rumbo in white on the cobalt band, dot in gold `#E0A44A`).
- Body background: off-white `#FBFCFE`; text navy ink `#1E2A44`.
- CTA button (email 2): gold `#E0A44A` background, dark navy text (`#3a2a08`), never white text on gold.
- Serif for the headline line, clean sans for body (email-safe fallbacks acceptable: Georgia for serif, Arial/Helvetica for body — email clients are limited; that's fine here, the site uses the real fonts).
- Keep them simple and robust across email clients (inline styles, tables if needed). Email HTML is the one place plain/robust markup beats cleverness.

## What to produce (in `project/src/lib/email/`)
- A `sendEmail` wrapper over Resend (`RESEND_API_KEY`).
- Three template functions returning subject + HTML: `acknowledgmentEmail`, `proposalsReadyEmail(token)`, `purchaseConfirmationEmail(order)`.
- Wire the three triggers into the SBI-07 lifecycle points.

## Verification criteria
- Each email renders with the brand header and correct copy role.
- Email 2 contains the correct `{APP_BASE_URL}/proposals/{token}` link.
- Sending works against Resend with the API key (or is safely no-op/logged if key absent in local dev — document behavior).
- Gold CTA uses dark navy text, not white.

## Do NOT
- Do NOT put the payment action in the email — payment happens on the proposals page. Email 2 only links there.
- Do NOT expose provider net prices or markup in any email.
- Do NOT block the pipeline on email failure — send best-effort; log failures.

## Handoff notes to write in task_list.md
- The three template function names/signatures.
- Behavior when `RESEND_API_KEY` is absent (local dev).
