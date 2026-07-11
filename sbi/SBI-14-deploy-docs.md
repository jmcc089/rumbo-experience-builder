# SBI-14 · Deploy (GitHub → Vercel → Neon) + docs

> **Model:** Sonnet 4.6, low effort.
> **Depends on:** all prior SBIs.
> **Objective:** Deploy the app and produce the closing documentation. Note: the full SAD + README polish belongs to the Assurance phase; this SBI gets the app live and lays down the documentation base.

---

## Deploy — ORDER MATTERS
1. **GitHub first:** create the repo, push all code. (Ensure `.env*` is gitignored; only `.env.example` is committed.)
2. **Then connect Vercel to the GitHub repo** for deployment. **Do NOT do this in reverse** — connecting the other way has caused problems before.
3. **Neon:** the DB is created by hand in the Neon dashboard (no MCP). Paste its connection string as the `DATABASE_URL` env var in Vercel.
4. **Set all env vars in Vercel** (values, not committed): `DATABASE_URL`, `DEEPSEEK_API_KEY`, `RESEND_API_KEY`, `APP_BASE_URL` (the deployed URL).
5. **Prefer MCP over CLI** for Vercel/GitHub steps where an MCP tool exists; CLI only if needed.

> **Env-var note:** Claude Code should indicate exactly when each key must be added and under what name, since these live outside the code. Never hardcode secrets.

## Documentation (base — Assurance finishes it) → in `documents/`
1. **ADR content** — the "why" of each significant decision, captured as readable sections (Nygard-style context/options/decision/consequences is fine, but presentation-as-Notion-page is the intended home; here produce the source content). Cover at least: engine-as-code (not prompt), CSP + scoring approach, continuous-time day model, multi-base lodging, Neon choice, markup 30%, availability-as-function, ephemeral-confirmation cache, simulated payment, no-scalability-by-design, provider-portal-instead-of-WhatsApp.
2. **README** — what the project is, how to run it, the stack, and the flow. Include the **production-honesty section** (curated seed vs real sources; simulated provider comms; simulated payment / real would need Stripe + legal; contract/penalty in the legal plane; **not built to scale by design**).
3. **SAD stub** — the as-built software architecture document skeleton (Assurance fills it fully): components, data model, the engine, the pipeline, the three portals.

> **Do NOT document** the informal-market provider-adoption friction (explicit client instruction — it goes nowhere).

## Name-check note (documentation)
- Add a one-line note that in real production the name "Rumbo" would require a trademark check (it's used by travel brands). Portfolio scope: fine as-is.

## Verification criteria
- The app is live on Vercel, connected to the GitHub repo, reading from Neon.
- All env vars are set in Vercel; no secrets are committed.
- The end-to-end demo works on the deployed URL: intake → (provider confirms) → proposals email → proposals page → simulated pay → confirmation email; operator dashboard reflects it; a repair can be triggered.
- `documents/` contains ADR content, README (with production-honesty section), and the SAD stub.

## Do NOT
- Do NOT connect Vercel→GitHub in reverse order.
- Do NOT commit any secret values.
- Do NOT document the provider-adoption-friction consideration.

## Handoff notes to write in task_list.md
- The live URL.
- Confirmation that all env vars are set and the end-to-end demo passes.
- What remains for Assurance (full SAD, README polish, final verification pass).
