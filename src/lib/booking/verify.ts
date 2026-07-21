// Rumbo · SBI-07 verification. Runs against the live Neon DB (uses real seed data).
// Run: npx tsx src/lib/booking/verify.ts
import { getPool } from "../db/pool";
import { ExperienceCategory } from "../types";
import { createRequest, runRequestPipeline, finalizeRequestProposals, getProposals, confirmAndPay } from "./index";
import { HOLD_WINDOW_MINUTES } from "./types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  const pool = getPool();

  // ── 1. Create request, unique non-guessable token ─────────────────────
  const intake = {
    name: "Verify SBI07",
    email: "verify-sbi07@example.com",
    arrival_date: "2026-08-10",
    departure_date: "2026-08-13",
    arrival_time: "10:00",
    departure_time: "18:00",
    travelers: 2,
    budget_total: 2000,
    prefs_json: {
      interests: ["nature", "culture"] as ExperienceCategory[],
      pace: "moderate" as const,
      mornings: "early_ok" as const,
      group_composition: "couple" as const,
      lodging_tier: "comfort" as const,
    },
    free_text: "Celebrating our anniversary, nothing too touristy.",
  };

  const { id: requestId, token } = await createRequest(intake);
  assert(!!requestId && !!token && token.length >= 32, "created request has id + long token");

  const { id: requestId2, token: token2 } = await createRequest(intake);
  assert(token !== token2, "two requests get distinct tokens");

  // ── 2. Run pipeline (Phase 1 sends requests; Phase 2 finalizes) ──────────
  await runRequestPipeline(requestId); // Phase 1: pending availability requests + open window
  await finalizeRequestProposals(requestId); // Phase 2: resolve (random 80% accept) + assemble
  const statusRow = await pool.query(`SELECT status FROM client_requests WHERE id = $1`, [requestId]);
  // NOTE: acceptance is truly random; with broad interests + full catalog this
  // is ~always proposals_ready, but a very unlucky roll could yield no_availability.
  assert(statusRow.rows[0].status === "proposals_ready", "pipeline sets status proposals_ready");

  // ── 3. getProposals starts the hold on first call, not before ─────────
  const beforeRow = await pool.query(`SELECT first_viewed_at FROM proposal_cache WHERE token = $1`, [token]);
  assert(beforeRow.rows[0].first_viewed_at === null, "hold not started before first getProposals call");

  const view1 = await getProposals(token);
  assert(view1.status === "ready", "getProposals returns ready");
  assert((view1.proposals?.length ?? 0) >= 1, "at least 1 proposal returned");
  assert(!!view1.expiresAt, "expiresAt set after first view");

  const afterRow = await pool.query(`SELECT first_viewed_at, expires_at FROM proposal_cache WHERE token = $1`, [
    token,
  ]);
  const firstViewedAt = afterRow.rows[0].first_viewed_at;
  assert(firstViewedAt !== null, "first_viewed_at set in DB after first view");

  await getProposals(token);
  const afterRow2 = await pool.query(`SELECT first_viewed_at FROM proposal_cache WHERE token = $1`, [token]);
  assert(
    afterRow2.rows[0].first_viewed_at.getTime() === firstViewedAt.getTime(),
    "second getProposals call does not reset the timer"
  );

  // ── 4. Pay within window materializes order + order_items ─────────────
  const payResult = await confirmAndPay(token, 0);
  assert(payResult.status === "paid", "confirmAndPay succeeds within window");
  assert(!!payResult.orderId, "order id returned");

  const orderRow = await pool.query(`SELECT * FROM orders WHERE id = $1`, [payResult.orderId]);
  assert(orderRow.rows.length === 1, "order row created");
  const itemsRow = await pool.query(`SELECT * FROM order_items WHERE order_id = $1`, [payResult.orderId]);
  assert(itemsRow.rows.length > 0, "order_items created");

  const paidStatusRow = await pool.query(`SELECT status FROM client_requests WHERE id = $1`, [requestId]);
  assert(paidStatusRow.rows[0].status === "paid", "request status set to paid");

  // Provider net price never surfaces to any client-facing return value:
  const payResultStr = JSON.stringify(payResult.itinerary);
  const anyNetPrice = itemsRow.rows.some((r) => payResultStr.includes(`"net_price":${r.net_price}`));
  assert(!anyNetPrice, "order_items net_price not embedded in the client-facing itinerary payload");

  // ── 5. Real paid order reduces availability for a second request ──────
  const firstExperienceId = itemsRow.rows.find((r) => r.item_type === "experience")?.ref_id;
  if (firstExperienceId) {
    const { spotsConsumedByRealOrders } = await import("./consumption");
    const consumed = await spotsConsumedByRealOrders(firstExperienceId, intake.arrival_date);
    assert(consumed >= intake.travelers, "spotsConsumedByRealOrders reflects the paid order's travelers");
  } else {
    console.log("SKIP: no experience item in day 1 to check consumption against");
  }

  // ── 6. Expiry path (simulate by forcing expires_at into the past) ──────
  await runRequestPipeline(requestId2);
  await finalizeRequestProposals(requestId2);
  const view3 = await getProposals(token2); // starts the hold
  assert(view3.status === "ready", "second request's proposals ready before forcing expiry");

  await pool.query(`UPDATE proposal_cache SET expires_at = now() - interval '1 minute' WHERE token = $1`, [
    token2,
  ]);

  const expiredView = await getProposals(token2);
  assert(expiredView.status === "expired", "getProposals reports expired once window has passed");

  const expiredStatusRow = await pool.query(`SELECT status FROM client_requests WHERE id = $1`, [requestId2]);
  assert(expiredStatusRow.rows[0].status === "expired", "request status set to expired");

  const expiredPay = await confirmAndPay(token2, 0);
  assert(expiredPay.status === "expired", "confirmAndPay refuses to pay after expiry");

  console.log(`\nHold window is ${HOLD_WINDOW_MINUTES} minutes.`);
  console.log("\nAll SBI-07 checks passed.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
