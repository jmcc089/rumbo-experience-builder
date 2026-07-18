// Rumbo · product configuration constants.
// Pure/runtime-dep-free so it is safe to import from both client and server code.

/**
 * Maximum trip length the builder accepts, expressed as the number of days
 * between arrival and departure (`departure_date − arrival_date`).
 *
 * Chosen from the seed-data distinctness sweep (SBI-10): at this span the engine
 * still returns 3 distinct proposals for typical broad-interest requests. Longer
 * trips consume most of the ~24-experience catalog, so any two itineraries
 * overlap > 60% and the engine's distinctness filter collapses them toward a
 * single option. See task_list.md open issues (SBI-05 distinctness) — a longer
 * cap becomes possible once that is addressed or the catalog grows.
 */
export const MAX_TRIP_SPAN_DAYS = 10;

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
