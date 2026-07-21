// Rumbo · product configuration constants.
// Pure/runtime-dep-free so it is safe to import from both client and server code.

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
