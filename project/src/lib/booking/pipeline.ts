// Rumbo · SBI-07: request → proposals pipeline.
// match filter (static catalog) -> availability confirmation (SBI-04) ->
// weight derivation + free-text extraction (SBI-06) -> assemble (SBI-05) ->
// store proposals under the request's token.
import { getPool } from "../db/pool";
import { applyMarkup } from "../pricing";
import {
  Experience,
  ExperienceCategory,
  Lodging,
  Provider,
  TransferMatrix,
} from "../types";
import {
  assemble,
  AssembleProblem,
  CandidateExperience,
  parseTime,
} from "../engine";
import {
  deriveWeights,
  selectedInterests,
  extractConstraints,
} from "../llm";
import { backgroundOccupancy, effectiveSpots, resolveConfirmation } from "../availability";
import { spotsConsumedByRealOrders } from "./consumption";
import { getRequestById, saveExtraction, saveProposals, setRequestStatus } from "./store";
import { PipelineHooks } from "./types";
import { sendProposalsReady } from "../email";

function dayOfWeekAbbr(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getUTCDay()];
}

function tripDayAbbrevs(arrivalDate: string, departureDate: string): Set<string> {
  const abbrevs = new Set<string>();
  const cursor = new Date(`${arrivalDate}T00:00:00Z`);
  const end = new Date(`${departureDate}T00:00:00Z`);
  while (cursor <= end) {
    abbrevs.add(dayOfWeekAbbr(cursor.toISOString().slice(0, 10)));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return abbrevs;
}

/** Step 2: coarse static-catalog match filter. Client never sees this. */
export async function matchFilter(
  interests: ExperienceCategory[],
  arrivalDate: string,
  departureDate: string,
  budgetTotal: number
): Promise<{ experiences: (Experience & { provider: Provider })[]; lodging: Lodging[] }> {
  const pool = getPool();
  const [expRes, provRes, lodgingRes] = await Promise.all([
    pool.query(`SELECT * FROM experiences`),
    pool.query(`SELECT * FROM providers`),
    pool.query(`SELECT * FROM lodging`),
  ]);

  const providersById = new Map<string, Provider>();
  for (const row of provRes.rows) {
    providersById.set(row.id, {
      id: row.id,
      name: row.name,
      zone_id: row.zone_id,
      provider_type: row.provider_type,
      confirmation_mode: row.confirmation_mode,
      reliability_score: Number(row.reliability_score),
      base_popularity: Number(row.base_popularity),
    });
  }

  const tripDays = tripDayAbbrevs(arrivalDate, departureDate);

  const experiences: (Experience & { provider: Provider })[] = [];
  for (const row of expRes.rows) {
    const provider = providersById.get(row.provider_id);
    if (!provider) continue;

    const exp: Experience = {
      id: row.id,
      provider_id: row.provider_id,
      name: row.name,
      category: row.category,
      zone_id: row.zone_id,
      duration_min: Number(row.duration_min),
      open_days: row.open_days,
      open_from: row.open_from,
      open_to: row.open_to,
      net_price: Number(row.net_price),
      capacity_per_slot: Number(row.capacity_per_slot),
      dependency: row.dependency,
    };

    if (interests.length && !interests.includes(exp.category)) continue;

    const openDays = exp.open_days.split(",").map((s) => s.trim());
    if (!openDays.some((d) => tripDays.has(d))) continue;

    // Loose sanity filter: a single experience's marked-up price alone must
    // not already exceed the whole-trip budget.
    if (applyMarkup(exp.net_price) > budgetTotal) continue;

    experiences.push({ ...exp, provider });
  }

  const lodging: Lodging[] = lodgingRes.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    zone_id: row.zone_id,
    tier: row.tier,
    net_price_per_night: Number(row.net_price_per_night),
    capacity: Number(row.capacity),
  }));

  return { experiences, lodging };
}

/**
 * Step 3: ask each matched provider via their portal (simulated). Uses the
 * representative arrival-date + the experience's own open_from slot to
 * resolve a single confirm/no_capacity/no_response result per experience for
 * this request (SBI-04's confirmation model is per-slot, not per-day; one
 * representative check stands in for "the provider was asked and answered").
 */
export async function confirmAvailability(
  experiences: (Experience & { provider: Provider })[],
  arrivalDate: string,
  travelers: number
): Promise<CandidateExperience[]> {
  const confirmed: CandidateExperience[] = [];

  for (const exp of experiences) {
    const slotStart = parseTime(exp.open_from);
    const occupancy = backgroundOccupancy(
      exp.id as unknown as number,
      arrivalDate,
      slotStart,
      exp.provider.base_popularity
    );
    const realConsumption = await spotsConsumedByRealOrders(exp.id, arrivalDate);
    const { available } = effectiveSpots(exp.capacity_per_slot, travelers, occupancy, realConsumption);

    const result = resolveConfirmation(
      exp.provider.confirmation_mode,
      exp.provider.reliability_score,
      available,
      exp.id as unknown as number,
      arrivalDate,
      slotStart
    );

    if (result !== "confirmed") continue;

    confirmed.push({
      ...exp,
      provider_base_popularity: exp.provider.base_popularity,
      provider_confirmation_mode: exp.provider.confirmation_mode,
      provider_reliability_score: exp.provider.reliability_score,
    });
  }

  return confirmed;
}

export async function loadTransferMatrix(): Promise<TransferMatrix[]> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM transfer_matrix`);
  return rows.map((r: any) => ({
    from_zone: r.from_zone,
    to_zone: r.to_zone,
    minutes: Number(r.minutes),
  }));
}

export function tripDates(arrivalDate: string, departureDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${arrivalDate}T00:00:00Z`);
  const end = new Date(`${departureDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function runPipeline(requestId: string, hooks: PipelineHooks = {}): Promise<void> {
  const request = await getRequestById(requestId);
  if (!request) throw new Error(`runPipeline: request ${requestId} not found`);

  const prefs = request.prefs_json;
  const interests = selectedInterests(prefs);
  const weights = deriveWeights(prefs);

  // LLM boundary: extract additive hard constraints + personalization notes
  // from free text. Fails safe to SAFE_DEFAULT_EXTRACTION on any LLM error.
  const extraction = await extractConstraints(request.free_text, {
    interests,
    pace: prefs.pace,
    mornings: prefs.mornings,
    group_composition: prefs.group_composition,
    lodging_tier: prefs.lodging_tier,
  });
  await saveExtraction(requestId, extraction);

  const { experiences: matched, lodging } = await matchFilter(
    interests,
    request.arrival_date,
    request.departure_date,
    request.budget_total
  );

  const candidatePool = await confirmAvailability(matched, request.arrival_date, request.travelers);

  // NOTE: `extraction.extra_hard_constraints` (dietary/mobility) are additive
  // filters per SBI-06's handoff. The current catalog schema has no
  // per-experience dietary/mobility fields to filter on (dietary options live
  // only on `provider_personalization`, used for personalization text, not as
  // a machine-checkable constraint) — so no candidate is dropped here today.
  // Left as the wiring point once such fields exist; see task_list.md open issues.

  const transferMatrix = await loadTransferMatrix();

  const problem: AssembleProblem = {
    dates: tripDates(request.arrival_date, request.departure_date),
    arrivalTime: request.arrival_time,
    departureTime: request.departure_time,
    travelers: request.travelers,
    budgetTotal: request.budget_total,
    interests,
    pace: prefs.pace ?? "moderate",
    mornings: prefs.mornings ?? "early_ok",
    lodgingTier: prefs.lodging_tier ?? "comfort",
    weights,
    candidatePool,
    transferMatrix,
    lodgingPool: lodging,
  };

  const result = assemble(problem);

  await saveProposals(requestId, request.token, result.proposals);
  await setRequestStatus(requestId, "proposals_ready");

  // SBI-08 trigger (email 2): the pipeline finished, proposals are ready.
  await sendProposalsReady(request.email, request.token);
  await hooks.notifyProposalsReady?.({ requestId, token: request.token, email: request.email });
}
