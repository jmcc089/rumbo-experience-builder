// Rumbo · SBI-04: deterministic availability & occupancy functions
//
// All functions here are PURE: no DB access, no Math.random(), no LLM calls.
// Randomness is simulated via a stable string hash (FNV-1a) so that the same
// inputs always produce the same outputs ("the world is deterministic given
// a seed").

/** Default seed for the deterministic "world". Override via RUMBO_WORLD_SEED env var. */
export const WORLD_SEED: number = (() => {
  const fromEnv = process.env.RUMBO_WORLD_SEED;
  if (fromEnv !== undefined && fromEnv !== "") {
    const parsed = Number(fromEnv);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 42;
})();

export type ConfirmationMode = "instant" | "on_request";
export type ConfirmationResult = "confirmed" | "no_capacity" | "no_response";

/**
 * Deterministic FNV-1a style string hash.
 * Same input string -> same 32-bit unsigned integer, always.
 */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime multiplication, done with 32-bit-safe math
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned 32-bit integer
  return hash >>> 0;
}

/**
 * Maps a stable hash of the given inputs to a float in [0, 1).
 */
export function hashToUnitFloat(...parts: (string | number)[]): number {
  const key = parts.join("|");
  const h = stableHash(key);
  return h / 0xffffffff;
}

/**
 * Returns the day-of-week bump used to model weekends being busier.
 * Sat +0.15, Sun +0.10, Fri +0.05, all other days +0.
 * `date` is expected as 'YYYY-MM-DD'.
 */
function dayOfWeekBump(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  if (day === 6) return 0.15; // Saturday
  if (day === 0) return 0.1; // Sunday
  if (day === 5) return 0.05; // Friday
  return 0;
}

/**
 * Returns a small bump for early-morning slots (5am-7am), which tend to run
 * higher occupancy for sunrise-dependent activities.
 * `slotStartMinutes` is minutes since midnight (e.g. 6:30am = 390).
 */
function timeOfDayBump(slotStartMinutes: number): number {
  const hour = Math.floor(slotStartMinutes / 60);
  if (hour >= 5 && hour < 7) return 0.08;
  return 0;
}

/**
 * Deterministic background occupancy in [0, 1] for a given experience/date/slot.
 *
 * Pure function: does NOT query the database. The caller is expected to have
 * already loaded the experience's provider and pass its `basePopularity` in.
 *
 * @param experienceId experience identifier
 * @param date 'YYYY-MM-DD'
 * @param slotStartMinutes minutes since midnight for the slot start
 * @param basePopularity provider's base_popularity, 0-1
 * @param seed world seed (defaults to WORLD_SEED)
 */
export function backgroundOccupancy(
  experienceId: number,
  date: string,
  slotStartMinutes: number,
  basePopularity: number,
  seed: number = WORLD_SEED
): number {
  const baseRandom = hashToUnitFloat(
    "occupancy",
    experienceId,
    date,
    slotStartMinutes,
    seed
  );

  // Blend the pseudo-random base with the provider's popularity: popularity
  // pulls occupancy toward itself, random component adds natural variance.
  const popularityWeight = 0.6;
  const randomWeight = 0.4;
  let occupancy = popularityWeight * basePopularity + randomWeight * baseRandom;

  occupancy += dayOfWeekBump(date);
  occupancy += timeOfDayBump(slotStartMinutes);

  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, occupancy));
}

/**
 * Computes how many spots remain in a slot, and whether that's enough for
 * the requested number of travelers.
 *
 * @param capacityPerSlot experience's total capacity per slot
 * @param travelers number of travelers requesting the slot
 * @param occupancy background occupancy in [0,1] (from backgroundOccupancy)
 * @param realOrderConsumption spots already consumed by real paid orders (optional)
 */
export function effectiveSpots(
  capacityPerSlot: number,
  travelers: number,
  occupancy: number,
  realOrderConsumption: number = 0
): { available: boolean; spotsLeft: number } {
  const occupiedByBackground = Math.round(capacityPerSlot * occupancy);
  const rawSpotsLeft = capacityPerSlot - occupiedByBackground - realOrderConsumption;
  const spotsLeft = Math.max(0, rawSpotsLeft);
  const available = spotsLeft >= travelers;
  return { available, spotsLeft };
}

/**
 * Resolves whether a booking attempt is confirmed, deterministically.
 *
 * - 'instant' (formal providers): confirmed if available, else no_capacity.
 *   Never returns 'no_response'.
 * - 'on_request' (informal providers): first a deterministic "did the
 *   provider respond" roll is made using reliabilityScore as the response
 *   probability. If they don't respond -> 'no_response'. If they do,
 *   result depends on isAvailable.
 */
export function resolveConfirmation(
  confirmationMode: ConfirmationMode,
  reliabilityScore: number,
  isAvailable: boolean,
  experienceId: number,
  date: string,
  slotStartMinutes: number,
  seed: number = WORLD_SEED
): ConfirmationResult {
  if (confirmationMode === "instant") {
    return isAvailable ? "confirmed" : "no_capacity";
  }

  // on_request: roll a deterministic value in [0,1) and compare to reliability.
  const responseRoll = hashToUnitFloat(
    "response",
    experienceId,
    date,
    slotStartMinutes,
    seed
  );

  const responded = responseRoll < reliabilityScore;
  if (!responded) return "no_response";

  return isAvailable ? "confirmed" : "no_capacity";
}
