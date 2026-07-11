// Manual verification script for SBI-04.
// Run with: npx tsx src/lib/availability/verify.ts (from project/ dir)

import {
  WORLD_SEED,
  backgroundOccupancy,
  effectiveSpots,
  resolveConfirmation,
} from "./index";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

console.log(`WORLD_SEED = ${WORLD_SEED}\n`);

// 1. Determinism
const occ1 = backgroundOccupancy(101, "2026-07-11", 540, 0.6);
const occ2 = backgroundOccupancy(101, "2026-07-11", 540, 0.6);
assert(occ1 === occ2, `backgroundOccupancy is deterministic (${occ1} === ${occ2})`);

// 2. Popular vs niche provider
const popular = backgroundOccupancy(101, "2026-07-11", 540, 0.9);
const niche = backgroundOccupancy(101, "2026-07-11", 540, 0.2);
console.log(`popular(0.9)=${popular.toFixed(3)} niche(0.2)=${niche.toFixed(3)}`);
assert(popular > niche, "higher base_popularity yields higher occupancy for same date/slot");

// Weekend bump check
const satOcc = backgroundOccupancy(101, "2026-07-11", 540, 0.5); // Sat
const monOcc = backgroundOccupancy(101, "2026-07-13", 540, 0.5); // Mon
console.log(`sat=${satOcc.toFixed(3)} mon=${monOcc.toFixed(3)}`);

// 3. effectiveSpots math
const es1 = effectiveSpots(20, 4, 0.5, 0);
console.log("effectiveSpots(20, 4, 0.5, 0) =", es1);
assert(es1.spotsLeft === 10, `spotsLeft should be 10, got ${es1.spotsLeft}`);
assert(es1.available === true, "4 travelers fit in 10 spots left");

const es2 = effectiveSpots(20, 15, 0.5, 0);
assert(es2.available === false, "15 travelers should not fit in 10 spots left");

const es3 = effectiveSpots(10, 1, 1.0, 0);
assert(es3.spotsLeft === 0, `full occupancy -> 0 spots left, got ${es3.spotsLeft}`);
assert(es3.available === false, "0 spots left cannot accommodate any traveler");

const es4 = effectiveSpots(20, 4, 0.5, 3);
assert(es4.spotsLeft === 7, `real order consumption reduces spots left, got ${es4.spotsLeft}`);

// 4. resolveConfirmation
const instantAvail = resolveConfirmation("instant", 0.1, true, 101, "2026-07-11", 540);
const instantUnavail = resolveConfirmation("instant", 0.1, false, 101, "2026-07-11", 540);
assert(instantAvail === "confirmed", "instant + available => confirmed");
assert(instantUnavail === "no_capacity", "instant + unavailable => no_capacity");
assert(
  instantAvail !== "no_response" && instantUnavail !== "no_response",
  "instant/formal never returns no_response"
);

// Sweep many experience ids with low reliability to show no_response can occur
let sawNoResponse = false;
let sawConfirmedOrNoCapacity = false;
for (let i = 0; i < 200; i++) {
  const result = resolveConfirmation(
    "on_request",
    0.1, // low reliability
    true,
    i,
    "2026-07-11",
    540
  );
  if (result === "no_response") sawNoResponse = true;
  if (result === "confirmed" || result === "no_capacity") sawConfirmedOrNoCapacity = true;
}
assert(sawNoResponse, "on_request with low reliability can produce no_response across many inputs");
assert(sawConfirmedOrNoCapacity, "on_request can also produce confirmed/no_capacity when it responds");

// Determinism of resolveConfirmation
const r1 = resolveConfirmation("on_request", 0.5, true, 202, "2026-07-11", 540);
const r2 = resolveConfirmation("on_request", 0.5, true, 202, "2026-07-11", 540);
assert(r1 === r2, "resolveConfirmation is deterministic for same inputs");

console.log("\nDone.");
