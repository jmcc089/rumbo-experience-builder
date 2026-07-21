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
} from "../engine";
import {
  deriveWeights,
  selectedInterests,
  extractConstraints,
} from "../llm";
import {
  getRequestById,
  saveExtraction,
  saveProposals,
  setRequestStatus,
  openProviderWindow,
} from "./store";
import {
  insertPendingRequests,
  getPendingForRequest,
  getConfirmedExperienceIds,
  resolveResponse,
} from "../provider/store";
import { PROVIDER_RESPONSE_WINDOW_MIN, PROVIDER_ACCEPT_RATE } from "../config";
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

  const lodging: Lodging[] = lodgingRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    zone_id: row.zone_id,
    tier: row.tier,
    net_price_per_night: Number(row.net_price_per_night),
    capacity: Number(row.capacity),
  }));

  return { experiences, lodging };
}

/** Map a matched experience (+ its provider) into an engine candidate. */
export function toCandidate(exp: Experience & { provider: Provider }): CandidateExperience {
  return {
    ...exp,
    provider_base_popularity: exp.provider.base_popularity,
    provider_confirmation_mode: exp.provider.confirmation_mode,
    provider_reliability_score: exp.provider.reliability_score,
  };
}

export async function loadTransferMatrix(): Promise<TransferMatrix[]> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM transfer_matrix`);
  return rows.map((r) => ({
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

// ─── Phase 1: send availability requests to every matching provider ─────────
//
// Runs synchronously right after intake (via `after()`), so it must be fast: it
// only matches the catalog, records one PENDING availability request per
// matched experience, and opens the acceptance window. Proposals are NOT built
// here — that happens in finalizeProposals() once the window closes.
export async function startAvailabilityRequests(requestId: string): Promise<void> {
  const request = await getRequestById(requestId);
  if (!request) throw new Error(`startAvailabilityRequests: request ${requestId} not found`);

  const prefs = request.prefs_json;
  const interests = selectedInterests(prefs);

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

  const { experiences: matched } = await matchFilter(
    interests,
    request.arrival_date,
    request.departure_date,
    request.budget_total
  );

  // One pending availability request per matched experience. NET rate (provider
  // total) is stored — never a client price.
  await insertPendingRequests(
    matched.map((exp) => ({
      requestId,
      experienceId: exp.id,
      providerId: exp.provider_id,
      netRate: exp.net_price * request.travelers,
    }))
  );

  await openProviderWindow(requestId, PROVIDER_RESPONSE_WINDOW_MIN);
}

// ─── Phase 2: window closed → resolve, then build proposals from acceptances ──
//
// Called by the cron poller for each request past its window. Idempotent: it
// only acts on requests still `awaiting_providers`.
export async function finalizeProposals(
  requestId: string,
  hooks: PipelineHooks = {}
): Promise<void> {
  const request = await getRequestById(requestId);
  if (!request) throw new Error(`finalizeProposals: request ${requestId} not found`);
  if (request.status !== "awaiting_providers") return; // already finalized / not ready

  // Resolve every still-pending request with a truly-random roll. Rows already
  // decided by a human in the portal are left as-is (they aren't pending).
  const pending = await getPendingForRequest(requestId);
  for (const p of pending) {
    const decision = Math.random() < PROVIDER_ACCEPT_RATE ? "confirmed" : "declined";
    await resolveResponse({
      requestId,
      experienceId: p.experience_id,
      providerId: p.provider_id,
      decision,
      netRate: p.net_rate,
    });
  }

  const confirmedIds = new Set(await getConfirmedExperienceIds(requestId));

  const prefs = request.prefs_json;
  const interests = selectedInterests(prefs);
  const weights = deriveWeights(prefs);

  // Rebuild the catalog match and keep only experiences whose provider accepted.
  const { experiences: matched, lodging } = await matchFilter(
    interests,
    request.arrival_date,
    request.departure_date,
    request.budget_total
  );
  const candidatePool = matched.filter((e) => confirmedIds.has(e.id)).map(toCandidate);

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

  if (result.proposals.length === 0) {
    // Too few acceptances (or none) to build a trip. Flag it; a dedicated
    // "no availability" email can be wired here later.
    await setRequestStatus(requestId, "no_availability");
    return;
  }

  await saveProposals(requestId, request.token, result.proposals);
  await setRequestStatus(requestId, "proposals_ready");

  // SBI-08 trigger (email 2): proposals are ready to pick + pay.
  await sendProposalsReady(request.email, request.token);
  await hooks.notifyProposalsReady?.({ requestId, token: request.token, email: request.email });
}
