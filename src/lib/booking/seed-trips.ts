// Rumbo · one-off dev seeder.
// Generates N realistic trips by driving the REAL booking pipeline (so every
// itinerary, order_item and price is engine-valid and internally consistent),
// then backdates timestamps to spread bookings across Jan–Jul 2026.
//
// Run: npx tsx src/lib/booking/seed-trips.ts
import { getPool } from "../db/pool";
import { ExperienceCategory, ClientPrefs } from "../types";
import {
  createRequest,
  runRequestPipeline,
  finalizeRequestProposals,
  getProposals,
  confirmAndPay,
} from "./index";
import { minBudgetFor } from "../config";

const N = 50;
const WIPE_OLD = true;

// Booking window: Jan 1 → Jul 21, 2026 (past, so it reads as real history).
const START_MS = Date.UTC(2026, 0, 1, 8, 0, 0);
const END_MS = Date.UTC(2026, 6, 21, 20, 0, 0);

const NAMES = [
  "María López", "James Carter", "Sofía Ramírez", "Liam O'Brien", "Ana Martínez",
  "Noah Schmidt", "Camila Torres", "Emma Rossi", "Diego Herrera", "Olivia Chen",
  "Lucas Moreau", "Valentina Cruz", "Ethan Walker", "Isabela Gómez", "Hugo Bernard",
];

const FREE_TEXT = [
  "Celebrating our anniversary, would love something romantic and private.",
  "First time in El Salvador — we want the highlights without rushing.",
  "Traveling as a couple, we're both vegetarian.",
  "Looking for a relaxed trip, nothing too touristy.",
  "Honeymoon — privacy and nice views matter a lot to us.",
  "Adventure-focused, we love hiking and surfing.",
  "Foodies here, we want the best local flavors.",
  "Family trip, we need kid-friendly options.",
  "",
  "",
];

// Interest chips → engine categories (mirrors the intake form).
const CHIPS: ExperienceCategory[][] = [
  ["nature", "adventure"],
  ["food"],
  ["culture"],
  ["beach"],
  ["coffee"],
];

const PACE: NonNullable<ClientPrefs["pace"]>[] = ["relaxed", "moderate", "packed"];
const MORNINGS: NonNullable<ClientPrefs["mornings"]>[] = ["early_ok", "no_early"];
const GROUPS: NonNullable<ClientPrefs["group_composition"]>[] = ["couple", "family", "friends", "solo"];
const TIERS: NonNullable<ClientPrefs["lodging_tier"]>[] = ["budget", "comfort", "premium"];

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function makeIntake() {
  const bookedAt = new Date(START_MS + Math.random() * (END_MS - START_MS));
  const bookedDate = bookedAt.toISOString().slice(0, 10);
  const arrival = addDays(bookedDate, randInt(7, 90));
  const span = randInt(2, 8);
  const departure = addDays(arrival, span);
  const tier = pick(TIERS);

  const nChips = randInt(1, 3);
  const chips = [...CHIPS].sort(() => Math.random() - 0.5).slice(0, nChips);
  const interests = Array.from(new Set(chips.flat()));

  const floor = minBudgetFor(span, tier);
  const budget_total = Math.round((floor * (1.5 + Math.random() * 1.5)) / 50) * 50;

  const i = Math.floor(Math.random() * 1e6);
  return {
    bookedAtISO: bookedAt.toISOString(),
    intake: {
      name: pick(NAMES),
      email: `seed+${i}@example.com`,
      arrival_date: arrival,
      departure_date: departure,
      arrival_time: pick(["09:00", "10:00", "11:00", "14:00"]),
      departure_time: pick(["16:00", "17:00", "18:00", "19:00"]),
      travelers: pick([1, 2, 2, 2, 3, 4, 5, 6]),
      budget_total,
      prefs_json: {
        interests,
        pace: pick(PACE),
        mornings: pick(MORNINGS),
        group_composition: pick(GROUPS),
        lodging_tier: tier,
      } as ClientPrefs,
      free_text: pick(FREE_TEXT),
    },
  };
}

async function backdate(pool: ReturnType<typeof getPool>, requestId: string, tsISO: string) {
  await pool.query(`UPDATE client_requests SET created_at = $2 WHERE id = $1`, [requestId, tsISO]);
  await pool.query(
    `UPDATE provider_responses
       SET requested_at = $2::timestamptz,
           decided_at = CASE WHEN decided_at IS NOT NULL
                             THEN $2::timestamptz + interval '10 minutes' ELSE NULL END
     WHERE request_id = $1`,
    [requestId, tsISO]
  );
  await pool.query(
    `UPDATE proposal_cache
       SET created_at = $2::timestamptz + interval '10 minutes',
           first_viewed_at = CASE WHEN first_viewed_at IS NOT NULL
                                  THEN $2::timestamptz + interval '12 minutes' ELSE NULL END,
           expires_at = CASE WHEN expires_at IS NOT NULL
                             THEN $2::timestamptz + interval '27 minutes' ELSE NULL END
     WHERE request_id = $1`,
    [requestId, tsISO]
  );
  await pool.query(
    `UPDATE orders SET created_at = $2::timestamptz + interval '15 minutes' WHERE request_id = $1`,
    [requestId, tsISO]
  );
}

async function main() {
  const pool = getPool();

  if (WIPE_OLD) {
    // FK-safe order: children before parents.
    await pool.query(`DELETE FROM order_items`);
    await pool.query(`DELETE FROM orders`);
    await pool.query(`DELETE FROM provider_responses`);
    await pool.query(`DELETE FROM proposal_cache`);
    await pool.query(`DELETE FROM client_requests`);
    console.log("Wiped old transactional data.");
  }

  const tally: Record<string, number> = {};
  const bump = (s: string) => (tally[s] = (tally[s] ?? 0) + 1);

  for (let n = 0; n < N; n++) {
    const { bookedAtISO, intake } = makeIntake();
    try {
      const { id: requestId, token } = await createRequest(intake);
      await runRequestPipeline(requestId);        // Phase 1: pending availability requests
      await finalizeRequestProposals(requestId);  // Phase 2: random 80% accept + assemble

      const { rows } = await pool.query(`SELECT status FROM client_requests WHERE id = $1`, [requestId]);
      if (rows[0].status !== "proposals_ready") {
        await backdate(pool, requestId, bookedAtISO); // e.g. no_availability
        bump(rows[0].status);
        continue;
      }

      // Role: ~72% paid, ~16% abandoned (proposals_ready), ~12% expired.
      const r = Math.random();
      if (r < 0.72) {
        const view = await getProposals(token); // starts the 15-min hold
        const idx = randInt(0, (view.proposals?.length ?? 1) - 1);
        const pay = await confirmAndPay(token, idx);
        bump(pay.status === "paid" ? "paid" : `pay_${pay.status}`);
      } else if (r < 0.88) {
        bump("proposals_ready"); // abandoned — never opened
      } else {
        await getProposals(token); // opens, then force-expire the hold
        await pool.query(
          `UPDATE proposal_cache SET expires_at = now() - interval '1 minute' WHERE token = $1`,
          [token]
        );
        await getProposals(token); // flips status → expired
        bump("expired");
      }

      await backdate(pool, requestId, bookedAtISO);
    } catch (err) {
      console.error(`Trip ${n} failed:`, err);
      bump("error");
    }
  }

  console.log("\nDone. Final status tally:");
  console.table(tally);
  const summary = await pool.query(`SELECT status, count(*) FROM client_requests GROUP BY status ORDER BY status`);
  console.table(summary.rows);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
