// Rumbo · product configuration constants.
// Pure/runtime-dep-free so it is safe to import from both client and server code.
import type { LodgingTier } from "./types";
import { MARKUP_RATE } from "./pricing";
/**
 * Maximum trip length the builder accepts, expressed as the number of days
 * between arrival and departure (`departure_date − arrival_date`).
 *
 * still returns 3 distinct proposals for typical broad-interest requests. Longer
 * trips consume most of the ~97-experience catalog, so any two itineraries
 * overlap > 60% and the engine's distinctness filter collapses them toward a
 * single option. See task_list.md open issues (SBI-05 distinctness) — a longer
 * cap becomes possible once that is addressed or the catalog grows.
 */
export const MAX_TRIP_SPAN_DAYS = 10;

// ─── Provider availability flow (request → accept → propose) ────────────────
//
// On submit, every matching provider/experience gets a *pending* availability
// request. A ~10-minute window later, still-pending requests are resolved by a
// simulated responder (truly random, PROVIDER_ACCEPT_RATE chance to accept),
// and proposals are assembled from the accepted experiences only. There is no
// formal/informal distinction — all providers go through the same flow.

/** Minutes a client request waits for provider acceptances before finalizing. */
export const PROVIDER_RESPONSE_WINDOW_MIN = 10;

/** Probability (0–1) that a simulated provider accepts an availability request. */
export const PROVIDER_ACCEPT_RATE = 0.8;

/** Whole days between two 'YYYY-MM-DD' dates (departure − arrival). */
export function tripSpanDays(arrival: string, departure: string): number {
  const a = new Date(`${arrival}T00:00:00Z`).getTime();
  const d = new Date(`${departure}T00:00:00Z`).getTime();
  return Math.round((d - a) / 86_400_000);
}

/** The latest departure date allowed for a given arrival, as 'YYYY-MM-DD'. */
export function maxDepartureDate(arrival: string): string {
  const d = new Date(`${arrival}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + MAX_TRIP_SPAN_DAYS);
  return d.toISOString().slice(0, 10);
}
// ─── Minimum budget floor ───────────────────────────────────────────────────
// The client enters a CLIENT-FACING budget (markup already included). Below a
// realistic per-day floor per tier, no trip can be assembled, so we reject at
// intake instead of silently returning zero proposals.
export const MIN_BUDGET_PER_DAY: Record<LodgingTier, number> = {
  budget: 70,
  comfort: 130,
  premium: 230,
};

/** Lowest client budget accepted for a trip of `spanDays` nights at `tier`. */
export function minBudgetFor(spanDays: number, tier: LodgingTier): number {
  return MIN_BUDGET_PER_DAY[tier] * Math.max(1, spanDays);
}

/** Client-facing budget spread across the trip, per night. */
export function budgetPerDay(spanDays: number, budgetTotal: number): number {
  return budgetTotal / Math.max(1, spanDays);
}

// ─── Budget → lodging tier (traveler-aware) ─────────────────────────────────
// The client no longer picks a tier; the budget implies it. Deriving it well
// means mirroring how the engine actually spends: experiences cost per person
// (net × travelers) while lodging is flat per night, all marked up for the
// client. So a night's realistic client cost at a given tier scales with the
// party size — a solo traveler unlocks a band far sooner than a family of four.
//
// Figures are NET (pre-markup), grounded in the real catalog (2026-07):
//   lodging/night avg  → budget ~$38, comfort ~$71, premium ~$130
//   experience avg     → ~$21, at a typical ~2.5 activities/day.
export const AVG_EXPERIENCE_NET = 21;
export const EXPERIENCES_PER_DAY = 2.5;
export const TIER_NIGHT_NET: Record<LodgingTier, number> = {
  budget: 40,
  comfort: 72,
  premium: 130,
};

/** Estimated client-facing (markup-included) spend per night at `tier`. */
export function estNightlyClient(tier: LodgingTier, travelers: number): number {
  const net =
    TIER_NIGHT_NET[tier] +
    EXPERIENCES_PER_DAY * AVG_EXPERIENCE_NET * Math.max(1, travelers);
  return net * (1 + MARKUP_RATE);
}

/**
 * Which lodging band a budget unlocks, given trip length and party size. Picks
 * the highest tier whose estimated nightly cost fits the per-night budget.
 * Below even the budget tier it still returns "budget" (we try; the engine's
 * hard budget guard drops proposals it genuinely can't assemble).
 */
export function tierForBudget(
  spanDays: number,
  budgetTotal: number,
  travelers: number
): LodgingTier {
  const perNight = budgetPerDay(spanDays, budgetTotal);
  if (perNight >= estNightlyClient("premium", travelers)) return "premium";
  if (perNight >= estNightlyClient("comfort", travelers)) return "comfort";
  return "budget";
}

/** True when the budget is below what even a budget-tier night realistically costs. */
export function isBudgetLow(
  spanDays: number,
  budgetTotal: number,
  travelers: number
): boolean {
  return budgetPerDay(spanDays, budgetTotal) < estNightlyClient("budget", travelers);
}
