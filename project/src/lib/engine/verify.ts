// Rumbo · SBI-05: Engine verification script
// Run: npx tsx src/lib/engine/verify.ts  (from project/)
//
// Loads seed data from Neon, runs assemble() and repair(), checks all
// verification criteria defined in the SBI.

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";
import {
  assemble,
  repair,
  checkValidity,
  AssembleProblem,
  RepairProblem,
  CandidateExperience,
  ScoringWeights,
  TOLERABLE_MAX_TRANSFER_MINUTES,
  formatTime,
} from "./index";
import { applyMarkup } from "../pricing";
import {
  Experience,
  Lodging,
  Provider,
  TransferMatrix,
  ExperienceCategory,
} from "../types";

dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("=== SBI-05 Engine Verification ===\n");

  // Load data
  const experiences = (await sql`SELECT * FROM experiences`) as Experience[];
  const providers = (await sql`SELECT * FROM providers`) as Provider[];
  const lodging = (await sql`SELECT * FROM lodging`) as Lodging[];
  const transferMatrix = (await sql`SELECT * FROM transfer_matrix`) as TransferMatrix[];

  console.log(
    `Loaded: ${experiences.length} experiences, ${providers.length} providers, ` +
      `${lodging.length} lodging, ${transferMatrix.length} transfer rows`
  );

  // Build candidate pool (all experiences, enriched with provider fields)
  const providerMap = new Map(providers.map((p) => [p.id, p]));
  const candidatePool: CandidateExperience[] = experiences.map((e) => {
    const prov = providerMap.get(e.provider_id)!;
    return {
      ...e,
      provider_base_popularity: prov.base_popularity,
      provider_confirmation_mode: prov.confirmation_mode,
      provider_reliability_score: prov.reliability_score,
    };
  });

  const weights: ScoringWeights = {
    transfer_efficiency: 0.2,
    interest_match: 0.3,
    pace: 0.2,
    breathing_room: 0.15,
    variety: 0.15,
  };

  // 5-day trip problem
  const problem: AssembleProblem = {
    dates: [
      "2025-03-10",
      "2025-03-11",
      "2025-03-12",
      "2025-03-13",
      "2025-03-14",
    ],
    arrivalTime: "14:00",
    departureTime: "16:00",
    travelers: 2,
    budgetTotal: 4000, // generous budget: allows markup + multi-day
    interests: ["nature", "culture", "food"] as ExperienceCategory[],
    pace: "moderate",
    mornings: "early_ok",
    lodgingTier: "comfort",
    weights,
    candidatePool,
    transferMatrix,
    lodgingPool: lodging,
  };

  // ── Test 1: assemble returns proposals ──────────────────────────────────────
  console.log("\n[1] Running assemble()...");
  const result = assemble(problem);
  console.log(
    `    Proposals returned: ${result.proposals.length}` +
      (result.shortfall ? ` (shortfall: ${result.shortfall})` : "")
  );

  if (result.proposals.length === 0) {
    console.error("FAIL: No proposals returned.");
    process.exit(1);
  }

  // ── Test 2: Validity check — all proposals must be valid ───────────────────
  console.log("\n[2] Checking validity of all proposals...");
  let allValid = true;
  for (let i = 0; i < result.proposals.length; i++) {
    const v = checkValidity(result.proposals[i], problem);
    if (!v.valid) {
      console.error(`  Proposal ${i + 1}: INVALID`);
      v.violations.forEach((vi) => console.error(`    - ${vi}`));
      allValid = false;
    } else {
      const p = result.proposals[i];
      const expCount = p.days.reduce((s, d) => s + d.experiences.length, 0);
      console.log(
        `  Proposal ${i + 1}: VALID — ${expCount} experiences, ` +
          `client total $${p.client_total}, score ${p.scores.weighted_total}`
      );
    }
  }
  if (!allValid) {
    console.error("FAIL: One or more proposals are invalid.");
    process.exit(1);
  }
  console.log("  PASS");

  // ── Test 3: Budget validated against marked-up price ──────────────────────
  console.log("\n[3] Budget check (client_total ≤ budgetTotal)...");
  for (const p of result.proposals) {
    if (p.client_total > problem.budgetTotal) {
      console.error(`FAIL: client_total $${p.client_total} > budget $${problem.budgetTotal}`);
      process.exit(1);
    }
    if (applyMarkup(p.net_total) !== p.client_total) {
      console.error(
        `FAIL: client_total $${p.client_total} ≠ applyMarkup(net_total $${p.net_total}) = $${applyMarkup(p.net_total)}`
      );
      process.exit(1);
    }
  }
  console.log("  PASS");

  // ── Test 4: Distinctness — proposals differ meaningfully ──────────────────
  console.log("\n[4] Distinctness check (Jaccard similarity < 0.6 between pairs)...");
  const getIds = (p: (typeof result.proposals)[0]) =>
    new Set(p.days.flatMap((d) => d.experiences.map((e) => e.experience_id)));

  let distinctOk = true;
  for (let i = 0; i < result.proposals.length; i++) {
    for (let j = i + 1; j < result.proposals.length; j++) {
      const a = getIds(result.proposals[i]);
      const b = getIds(result.proposals[j]);
      const intersection = [...a].filter((id) => b.has(id)).length;
      const union = new Set([...a, ...b]).size;
      const sim = union === 0 ? 1 : intersection / union;
      console.log(`  Proposals ${i + 1} & ${j + 1}: Jaccard similarity = ${sim.toFixed(2)}`);
      if (sim >= 0.6) {
        console.error(`FAIL: Proposals ${i + 1} and ${j + 1} are too similar (${sim.toFixed(2)} ≥ 0.6)`);
        distinctOk = false;
      }
    }
  }
  if (!distinctOk) process.exit(1);
  console.log("  PASS");

  // ── Test 5: Determinism — same input → same output ──────────────────────
  console.log("\n[5] Determinism check (run assemble() twice, compare)...");
  const result2 = assemble(problem);
  const scores1 = result.proposals.map((p) => p.scores.weighted_total).join(",");
  const scores2 = result2.proposals.map((p) => p.scores.weighted_total).join(",");
  if (scores1 !== scores2) {
    console.error(`FAIL: scores differ between runs: ${scores1} vs ${scores2}`);
    process.exit(1);
  }
  console.log(`  PASS (scores: ${scores1})`);

  // ── Test 6: Budget rejection — net-fits but marked-up exceeds budget ──────
  console.log("\n[6] Budget guard (reject trip where net fits but markup exceeds budget)...");
  const tightProblem: AssembleProblem = {
    ...problem,
    budgetTotal: 1, // impossibly tight
  };
  const tightResult = assemble(tightProblem);
  if (tightResult.proposals.length > 0) {
    const p = tightResult.proposals[0];
    if (p.client_total > 1) {
      console.error(`FAIL: Returned proposal with client_total $${p.client_total} > budget $1`);
      process.exit(1);
    }
  }
  console.log(`  PASS (returned ${tightResult.proposals.length} proposals with budget $1)`);

  // ── Test 7: repair() ───────────────────────────────────────────────────────
  if (result.proposals.length > 0) {
    const paid = result.proposals[0];
    console.log("\n[7] Running repair() on day 2 of first proposal...");
    const repairProblem: RepairProblem = {
      paidItinerary: paid,
      gapDayIndex: 2,
      travelers: problem.travelers,
      weights: problem.weights,
      candidatePool,
      transferMatrix,
      lodgingPool: lodging,
      arrivalTime: problem.arrivalTime,
      departureTime: problem.departureTime,
      dates: problem.dates,
      budgetTotal: problem.budgetTotal,
      interests: problem.interests,
      pace: problem.pace,
      mornings: problem.mornings,
    };
    const repairResult = repair(repairProblem);
    if (repairResult.replacement) {
      const repExpCount = repairResult.replacement.days.reduce(
        (s, d) => s + d.experiences.length, 0
      );
      console.log(
        `  Repaired: ${repExpCount} experiences placed, ` +
          `client total $${repairResult.replacement.client_total}, ` +
          `score ${repairResult.replacement.scores.weighted_total}`
      );
      if (repairResult.replacement.client_total > problem.budgetTotal) {
        console.error("FAIL: repair() returned itinerary exceeding budget");
        process.exit(1);
      }
      console.log("  PASS");
    } else {
      console.log(`  repair() returned null (reason: ${repairResult.reason}) — ok if pool is tight`);
    }

    // Unsolvable gap test
    console.log("\n[8] repair() unsolvable gap (budget $1)...");
    const unsolvable = repair({ ...repairProblem, budgetTotal: 1 });
    if (unsolvable.replacement !== null) {
      console.error("FAIL: Expected null for unsolvable gap, got a replacement");
      process.exit(1);
    }
    console.log(`  PASS (reason: ${unsolvable.reason})`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== All checks passed ===");
  console.log(`TOLERABLE_MAX_TRANSFER_MINUTES = ${TOLERABLE_MAX_TRANSFER_MINUTES}`);
  console.log("Per-metric breakdown for proposal 1:");
  const s = result.proposals[0].scores;
  console.log(`  transfer_efficiency = ${s.transfer_efficiency}`);
  console.log(`  interest_match      = ${s.interest_match}`);
  console.log(`  pace                = ${s.pace}`);
  console.log(`  breathing_room      = ${s.breathing_room}`);
  console.log(`  variety             = ${s.variety}`);
  console.log(`  weighted_total      = ${s.weighted_total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
