// Rumbo · SBI-05: Temporal CSP + scoring engine
//
// Two entry points:
//   assemble(problem) → up to 3 distinct valid itineraries
//   repair(problem)   → re-solve one gap day in a paid itinerary
//
// All logic is deterministic application code. No LLM, no Math.random().
// Availability must be pre-confirmed by the caller (SBI-04); this module
// receives a candidatePool of already-confirmed experiences.

import {
  Experience,
  ExperienceCategory,
  Lodging,
  LodgingTier,
  TransferMatrix,
  ItineraryDay,
  ItinerarySnapshot,
  ItineraryScores,
} from "../types";
import { applyMarkup } from "../pricing";

// ─── Public constants ─────────────────────────────────────────────────────────

/** Total daily transfer minutes at which transfer_efficiency hits 0. */
export const TOLERABLE_MAX_TRANSFER_MINUTES = 240;

// ─── Private constants ────────────────────────────────────────────────────────

const SUNRISE_START_MIN = 330; // 05:30
const SUNRISE_END_MIN = 420; // 07:00
const TIDE_WINDOWS: Array<[number, number]> = [
  [360, 540], // 06:00–09:00
  [1080, 1200], // 18:00–20:00
];
const DEFAULT_DAY_START_MIN = 480; // 08:00 (lodging checkout)
const DEFAULT_DAY_END_MIN = 1260; // 21:00
const NO_EARLY_THRESHOLD_MIN = 540; // 09:00
const ACTIVITY_BUFFER_MIN = 30; // minimum gap between activities
const MAX_CANDIDATES_TO_SCORE = 60;
const DISTINCTNESS_MAX_SIMILARITY = 0.6; // Jaccard threshold

// ─── Public types ─────────────────────────────────────────────────────────────

/** Experience record enriched with its provider's availability-relevant fields. */
export interface CandidateExperience extends Experience {
  provider_base_popularity: number;
  provider_confirmation_mode: "instant" | "on_request";
  provider_reliability_score: number;
}

export interface ScoringWeights {
  transfer_efficiency: number;
  interest_match: number;
  pace: number;
  breathing_room: number;
  variety: number;
}

export interface AssembleProblem {
  dates: string[]; // YYYY-MM-DD, in trip order
  arrivalTime: string; // HH:MM — day 1 cannot start before this
  departureTime: string; // HH:MM — last day must end no later than this
  travelers: number;
  budgetTotal: number; // client budget; validated against marked-up price
  interests: ExperienceCategory[];
  pace: "relaxed" | "moderate" | "packed";
  mornings: "early_ok" | "no_early";
  lodgingTier: LodgingTier;
  weights: ScoringWeights;
  candidatePool: CandidateExperience[]; // already confirmed available
  transferMatrix: TransferMatrix[];
  lodgingPool: Lodging[];
}

export interface AssembleResult {
  proposals: ItinerarySnapshot[];
  shortfall?: string; // set when fewer than 3 distinct itineraries found
}

export interface RepairProblem {
  paidItinerary: ItinerarySnapshot;
  gapDayIndex: number; // 1-based
  travelers: number;
  weights: ScoringWeights;
  candidatePool: CandidateExperience[];
  transferMatrix: TransferMatrix[];
  lodgingPool: Lodging[];
  arrivalTime: string;
  departureTime: string;
  dates: string[];
  budgetTotal: number;
  interests: ExperienceCategory[];
  pace: "relaxed" | "moderate" | "packed";
  mornings: "early_ok" | "no_early";
}

export interface RepairResult {
  replacement: ItinerarySnapshot | null;
  reason?: string;
}

export interface ValidityResult {
  valid: boolean;
  violations: string[];
}

// ─── Private types ────────────────────────────────────────────────────────────

interface ScheduledItem {
  experience: CandidateExperience;
  startMin: number;
  endMin: number;
}

interface DayPlan {
  dayIndex: number;
  date: string;
  zoneId: string;
  lodgingId: string;
  scheduledExperiences: ScheduledItem[];
  totalTransferMin: number; // intra-day transfer minutes
  inboundTransferMin: number; // transfer from previous zone
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dayOfWeekAbbr(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getUTCDay()];
}

function isOpenOnDay(exp: Experience, date: string): boolean {
  const dow = dayOfWeekAbbr(date);
  return exp.open_days
    .split(",")
    .map((s) => s.trim())
    .includes(dow);
}

function buildTransferMap(matrix: TransferMatrix[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of matrix) {
    map.set(`${row.from_zone}|${row.to_zone}`, row.minutes);
  }
  return map;
}

function getTransferMin(
  fromZone: string,
  toZone: string,
  map: Map<string, number>
): number {
  if (fromZone === toZone) return 0;
  return map.get(`${fromZone}|${toZone}`) ?? 90; // 90 min fallback
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Dependency validation ────────────────────────────────────────────────────

function dependencyAllowed(
  exp: CandidateExperience,
  startMin: number,
  noEarlyMornings: boolean
): boolean {
  if (!exp.dependency) return true;

  if (exp.dependency === "sunrise_only") {
    if (noEarlyMornings) return false; // sunrise requires early start
    return startMin >= SUNRISE_START_MIN && startMin <= SUNRISE_END_MIN;
  }

  if (exp.dependency === "tide_dependent") {
    return TIDE_WINDOWS.some(([ws, we]) => startMin >= ws && startMin <= we);
  }

  // weather_sensitive: treat as soft (always ok) in v1
  return true;
}

// ─── Day-filling (core CSP) ───────────────────────────────────────────────────

/**
 * Greedy constraint-satisfying day filler.
 * Tries each experience in `ordered` in sequence, placing it at the earliest
 * valid start time after the previous activity. Returns the placed items and
 * total intra-day transfer minutes.
 */
function fillDay(
  date: string,
  dayStartMin: number,
  dayEndMin: number,
  baseZoneId: string,
  noEarlyMornings: boolean,
  ordered: CandidateExperience[],
  transferMap: Map<string, number>,
  maxExperiences: number
): { scheduledExps: ScheduledItem[]; totalTransferMin: number } {
  const effectiveStart = noEarlyMornings
    ? Math.max(dayStartMin, NO_EARLY_THRESHOLD_MIN)
    : dayStartMin;

  const result: ScheduledItem[] = [];
  let cursor = effectiveStart;
  let currentZone = baseZoneId;
  let totalTransferMin = 0;
  const usedInDay = new Set<string>();

  for (const exp of ordered) {
    if (result.length >= maxExperiences) break;
    if (usedInDay.has(exp.id)) continue;
    if (!isOpenOnDay(exp, date)) continue;

    const transferMin = getTransferMin(currentZone, exp.zone_id, transferMap);
    const arrivalAtExp = cursor + transferMin;
    const expOpenFrom = parseTime(exp.open_from);
    const expOpenTo = parseTime(exp.open_to);

    let startMin = Math.max(arrivalAtExp, expOpenFrom);

    // Dependency-constrained start
    if (exp.dependency === "sunrise_only") {
      if (noEarlyMornings) continue;
      startMin = SUNRISE_START_MIN;
      if (startMin < arrivalAtExp) continue; // too late for sunrise
    } else if (exp.dependency === "tide_dependent") {
      const window = TIDE_WINDOWS.find(([ws]) => ws >= arrivalAtExp);
      if (!window) continue;
      startMin = Math.max(startMin, window[0]);
    }

    const endMin = startMin + exp.duration_min;

    if (endMin > expOpenTo) continue;
    if (endMin > dayEndMin) continue;
    if (noEarlyMornings && startMin < NO_EARLY_THRESHOLD_MIN) continue;
    if (!dependencyAllowed(exp, startMin, noEarlyMornings)) continue;

    usedInDay.add(exp.id);
    result.push({ experience: exp, startMin, endMin });
    totalTransferMin += transferMin;
    cursor = endMin + ACTIVITY_BUFFER_MIN;
    currentZone = exp.zone_id;
  }

  return { scheduledExps: result, totalTransferMin };
}

// ─── Cost computation ─────────────────────────────────────────────────────────

// Neon returns numeric columns as strings; always coerce before arithmetic.
const num = (v: number | string): number => Number(v);

function computeCosts(
  dayPlans: DayPlan[],
  travelers: number,
  lodgingMap: Map<string, Lodging>
): { netTotal: number; clientTotal: number } {
  let netTotal = 0;
  for (const day of dayPlans) {
    for (const { experience } of day.scheduledExperiences) {
      netTotal += num(experience.net_price) * travelers;
    }
    const lodging = lodgingMap.get(day.lodgingId);
    if (lodging) netTotal += num(lodging.net_price_per_night);
  }
  return { netTotal: round2(netTotal), clientTotal: round2(applyMarkup(netTotal)) };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreItinerary(
  dayPlans: DayPlan[],
  interests: ExperienceCategory[],
  pace: "relaxed" | "moderate" | "packed",
  weights: ScoringWeights
): ItineraryScores {
  const allExps = dayPlans.flatMap((d) => d.scheduledExperiences.map((s) => s.experience));

  // 1. Transfer efficiency
  const totalTransfer = dayPlans.reduce(
    (sum, d) => sum + d.totalTransferMin + d.inboundTransferMin,
    0
  );
  const transfer_efficiency = Math.max(
    0,
    1 - totalTransfer / TOLERABLE_MAX_TRANSFER_MINUTES
  );

  // 2. Interest match
  let interest_match = 1;
  if (interests.length > 0 && allExps.length > 0) {
    const matched = allExps.filter((e) => interests.includes(e.category)).length;
    interest_match = matched / allExps.length;
  }

  // 3. Pace: closeness of avg experiences/day to target
  const paceTarget: Record<string, number> = {
    relaxed: 1.5,
    moderate: 2.5,
    packed: 3.5,
  };
  const avgExpsPerDay = dayPlans.length > 0 ? allExps.length / dayPlans.length : 0;
  const paceDiff = Math.abs(avgExpsPerDay - (paceTarget[pace] ?? 2.5));
  const pace_score = Math.max(0, 1 - paceDiff / 3);

  // 4. Breathing room: average slack between consecutive activities
  let totalSlack = 0;
  let slackPairs = 0;
  for (const day of dayPlans) {
    const items = day.scheduledExperiences;
    for (let i = 1; i < items.length; i++) {
      const slack = items[i].startMin - items[i - 1].endMin - ACTIVITY_BUFFER_MIN;
      totalSlack += Math.max(0, slack);
      slackPairs++;
    }
  }
  const avgSlack = slackPairs > 0 ? totalSlack / slackPairs : 60;
  const breathing_room = Math.min(1, avgSlack / 120); // 120 min = full score

  // 5. Variety: unique categories relative to experience count (capped at 6)
  const categories = new Set(allExps.map((e) => e.category));
  const variety =
    allExps.length > 0 ? categories.size / Math.min(allExps.length, 6) : 0;

  const weighted_total =
    weights.transfer_efficiency * transfer_efficiency +
    weights.interest_match * interest_match +
    weights.pace * pace_score +
    weights.breathing_room * breathing_room +
    weights.variety * variety;

  return {
    transfer_efficiency: round2(transfer_efficiency),
    interest_match: round2(interest_match),
    pace: round2(pace_score),
    breathing_room: round2(breathing_room),
    variety: round2(variety),
    weighted_total: round2(weighted_total),
  };
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

function buildSnapshot(
  dayPlans: DayPlan[],
  travelers: number,
  lodgingPool: Lodging[],
  interests: ExperienceCategory[],
  pace: "relaxed" | "moderate" | "packed",
  weights: ScoringWeights
): ItinerarySnapshot {
  const lodgingMap = new Map(lodgingPool.map((l) => [l.id, l]));
  const { netTotal, clientTotal } = computeCosts(dayPlans, travelers, lodgingMap);
  const scores = scoreItinerary(dayPlans, interests, pace, weights);

  const days: ItineraryDay[] = dayPlans.map((dp) => ({
    day_index: dp.dayIndex,
    zone_id: dp.zoneId,
    lodging_id: dp.lodgingId,
    experiences: dp.scheduledExperiences.map(({ experience, startMin, endMin }) => ({
      experience_id: experience.id,
      start_time: formatTime(startMin),
      end_time: formatTime(endMin),
    })),
    transfer_in_minutes: dp.inboundTransferMin,
  }));

  return { days, net_total: netTotal, client_total: clientTotal, scores };
}

// ─── Distinctness ─────────────────────────────────────────────────────────────

function jaccardSimilarity(a: ItinerarySnapshot, b: ItinerarySnapshot): number {
  const setA = new Set(
    a.days.flatMap((d) => d.experiences.map((e) => e.experience_id))
  );
  const setB = new Set(
    b.days.flatMap((d) => d.experiences.map((e) => e.experience_id))
  );
  const intersection = [...setA].filter((id) => setB.has(id)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 1 : intersection / union;
}

function selectDistinct(
  snapshots: ItinerarySnapshot[],
  maxSimilarity: number = DISTINCTNESS_MAX_SIMILARITY
): ItinerarySnapshot[] {
  if (snapshots.length === 0) return [];
  const selected: ItinerarySnapshot[] = [snapshots[0]];
  for (let i = 1; i < snapshots.length && selected.length < 3; i++) {
    const tooSimilar = selected.some(
      (s) => jaccardSimilarity(s, snapshots[i]) >= maxSimilarity
    );
    if (!tooSimilar) selected.push(snapshots[i]);
  }
  return selected;
}

// ─── Candidate builder ────────────────────────────────────────────────────────

/**
 * Build one candidate itinerary given a zone sequence and an experience
 * ordering bias. Returns null if the result violates budget or has no lodging.
 */
function buildCandidate(
  problem: AssembleProblem,
  transferMap: Map<string, number>,
  zoneSequence: string[],
  orderBias: (
    exps: CandidateExperience[],
    dayIndex: number,
    zoneId: string
  ) => CandidateExperience[]
): DayPlan[] | null {
  const {
    dates,
    arrivalTime,
    departureTime,
    travelers,
    budgetTotal,
    pace,
    mornings,
    lodgingTier,
    candidatePool,
    lodgingPool,
  } = problem;

  const noEarly = mornings === "no_early";
  const numDays = dates.length;

  const paceMaxExp: Record<string, number> = {
    relaxed: 2,
    moderate: 3,
    packed: 4,
  };
  const maxExpPerDay = paceMaxExp[pace] ?? 3;

  // Build lodging lookup by zone
  const lodgingByZone = new Map<string, Lodging[]>();
  for (const l of lodgingPool) {
    if (!lodgingByZone.has(l.zone_id)) lodgingByZone.set(l.zone_id, []);
    lodgingByZone.get(l.zone_id)!.push(l);
  }

  function pickLodging(zoneId: string): Lodging | null {
    const candidates = lodgingByZone.get(zoneId) ?? [];
    return (
      candidates.find((l) => l.tier === lodgingTier) ??
      candidates.find((l) => l.tier === "comfort") ??
      candidates[0] ??
      null
    );
  }

  const dayPlans: DayPlan[] = [];
  const usedExpIds = new Set<string>();
  let runningNet = 0;

  for (let di = 0; di < numDays; di++) {
    const date = dates[di];
    const dayIndex = di + 1;
    const isFirstDay = di === 0;
    const isLastDay = di === numDays - 1;

    const zoneId = zoneSequence[di % zoneSequence.length];
    const lodging = pickLodging(zoneId);
    if (!lodging) return null;

    const prevZoneId = di > 0 ? dayPlans[di - 1].zoneId : zoneId;
    const inboundTransferMin =
      di > 0 ? getTransferMin(prevZoneId, zoneId, transferMap) : 0;

    const dayStartMin = isFirstDay
      ? parseTime(arrivalTime)
      : DEFAULT_DAY_START_MIN + inboundTransferMin;
    const dayEndMin = isLastDay
      ? parseTime(departureTime)
      : DEFAULT_DAY_END_MIN;

    if (dayStartMin >= dayEndMin) {
      // No usable window (very late arrival or very early departure)
      runningNet += num(lodging.net_price_per_night);
      dayPlans.push({
        dayIndex,
        date,
        zoneId,
        lodgingId: lodging.id,
        scheduledExperiences: [],
        totalTransferMin: 0,
        inboundTransferMin,
      });
      continue;
    }

    // Filter candidates not yet used, open today, affordable
    const available = candidatePool.filter((e) => {
      if (usedExpIds.has(e.id)) return false;
      if (!isOpenOnDay(e, date)) return false;
      const costIfAdded = applyMarkup(
        runningNet + num(e.net_price) * travelers + num(lodging.net_price_per_night)
      );
      return costIfAdded <= budgetTotal;
    });

    const ordered = orderBias(available, dayIndex, zoneId);

    const { scheduledExps, totalTransferMin } = fillDay(
      date,
      dayStartMin,
      dayEndMin,
      zoneId,
      noEarly,
      ordered,
      transferMap,
      maxExpPerDay
    );

    for (const { experience } of scheduledExps) {
      runningNet += num(experience.net_price) * travelers;
      usedExpIds.add(experience.id);
    }
    runningNet += num(lodging.net_price_per_night);

    dayPlans.push({
      dayIndex,
      date,
      zoneId,
      lodgingId: lodging.id,
      scheduledExperiences: scheduledExps,
      totalTransferMin,
      inboundTransferMin,
    });
  }

  // Final budget guard
  if (applyMarkup(runningNet) > budgetTotal) return null;

  return dayPlans;
}

// ─── assemble ────────────────────────────────────────────────────────────────

export function assemble(problem: AssembleProblem): AssembleResult {
  const transferMap = buildTransferMap(problem.transferMatrix);
  const { interests, pace, candidatePool, lodgingPool } = problem;
  const numDays = problem.dates.length;

  // Rank zones by experience density weighted by interest match
  const zoneScore = new Map<string, number>();
  for (const exp of candidatePool) {
    const weight = interests.length === 0 || interests.includes(exp.category) ? 2 : 1;
    zoneScore.set(exp.zone_id, (zoneScore.get(exp.zone_id) ?? 0) + weight);
  }

  const zonesWithLodging = [
    ...new Set(lodgingPool.map((l) => l.zone_id)),
  ].sort((a, b) => (zoneScore.get(b) ?? 0) - (zoneScore.get(a) ?? 0));

  if (zonesWithLodging.length === 0) {
    return { proposals: [], shortfall: "No lodging available in any zone." };
  }

  // Pad a sequence to numDays by cycling
  const padSeq = (seq: string[]): string[] => {
    const out: string[] = [];
    for (let i = 0; i < numDays; i++) out.push(seq[i % seq.length]);
    return out;
  };

  // Four zone sequences for variety
  const sequences: string[][] = [
    padSeq(zonesWithLodging),
    padSeq([...zonesWithLodging.slice(1), zonesWithLodging[0]].filter(Boolean)),
    padSeq([...zonesWithLodging].reverse()),
    padSeq(
      zonesWithLodging.reduce((acc: string[], z, i) => {
        if (i % 2 === 0) acc.unshift(z);
        else acc.push(z);
        return acc;
      }, [])
    ),
  ];

  // Four bias functions for experience selection
  type Bias = (
    exps: CandidateExperience[],
    dayIndex: number,
    zoneId: string
  ) => CandidateExperience[];

  const biases: Bias[] = [
    // B0: interest match first, then price ascending
    (exps) =>
      [...exps].sort((a, b) => {
        const ai = interests.includes(a.category) ? 0 : 1;
        const bi2 = interests.includes(b.category) ? 0 : 1;
        return ai - bi2 || num(a.net_price) - num(b.net_price);
      }),

    // B1: same zone first (minimise transfers), then interest
    (exps, _dayIndex, zoneId) =>
      [...exps].sort((a, b) => {
        const az = a.zone_id === zoneId ? 0 : 1;
        const bz = b.zone_id === zoneId ? 0 : 1;
        return (
          az - bz ||
          (interests.includes(a.category) ? 0 : 1) -
            (interests.includes(b.category) ? 0 : 1)
        );
      }),

    // B2: category variety — prefer categories not yet seen today
    (exps) => {
      const seen = new Map<string, number>();
      return [...exps].sort((a, b) => {
        const ac = seen.get(a.category) ?? 0;
        const bc = seen.get(b.category) ?? 0;
        if (ac !== bc) return ac - bc;
        return (interests.includes(a.category) ? 0 : 1) -
          (interests.includes(b.category) ? 0 : 1);
      });
    },

    // B3: longer duration first (fuller days)
    (exps) => [...exps].sort((a, b) => b.duration_min - a.duration_min),
  ];

  // Generate candidates
  const snapshots: ItinerarySnapshot[] = [];

  outer: for (const seq of sequences) {
    for (const bias of biases) {
      const plans = buildCandidate(problem, transferMap, seq, bias);
      if (!plans) continue;
      const totalExps = plans.reduce(
        (s, d) => s + d.scheduledExperiences.length,
        0
      );
      if (totalExps === 0) continue;
      snapshots.push(
        buildSnapshot(plans, problem.travelers, problem.lodgingPool, interests, pace, problem.weights)
      );
      if (snapshots.length >= MAX_CANDIDATES_TO_SCORE) break outer;
    }
  }

  // Sort by weighted score and pick top 3 distinct
  snapshots.sort((a, b) => b.scores.weighted_total - a.scores.weighted_total);
  const proposals = selectDistinct(snapshots);

  if (proposals.length === 0) {
    return {
      proposals: [],
      shortfall:
        "No valid itineraries could be built with the given constraints and candidate pool.",
    };
  }

  const shortfall =
    proposals.length < 3
      ? `Only ${proposals.length} distinct valid itinerar${proposals.length === 1 ? "y" : "ies"} found.`
      : undefined;

  return { proposals, shortfall };
}

// ─── repair ───────────────────────────────────────────────────────────────────

export function repair(problem: RepairProblem): RepairResult {
  const {
    paidItinerary,
    gapDayIndex,
    travelers,
    weights,
    candidatePool,
    transferMatrix,
    lodgingPool,
    arrivalTime,
    departureTime,
    dates,
    budgetTotal,
    interests,
    pace,
    mornings,
  } = problem;

  const transferMap = buildTransferMap(transferMatrix);
  const expMap = new Map(candidatePool.map((e) => [e.id, e]));
  const lodgingMap = new Map(lodgingPool.map((l) => [l.id, l]));

  const numDays = paidItinerary.days.length;
  const gapIdx0 = gapDayIndex - 1;
  const gapDay = paidItinerary.days[gapIdx0];

  if (!gapDay) {
    return { replacement: null, reason: `Day ${gapDayIndex} not found in paid itinerary` };
  }

  const date = dates[gapIdx0] ?? dates[dates.length - 1];
  const isFirstDay = gapIdx0 === 0;
  const isLastDay = gapIdx0 === numDays - 1;
  const noEarly = mornings === "no_early";

  // Cost of all other days (fixed)
  let fixedNet = 0;
  const usedIds = new Set<string>();
  for (let di = 0; di < numDays; di++) {
    if (di === gapIdx0) continue;
    const d = paidItinerary.days[di];
    for (const se of d.experiences) {
      const exp = expMap.get(se.experience_id);
      if (exp) fixedNet += num(exp.net_price) * travelers;
      usedIds.add(se.experience_id);
    }
    const lodging = lodgingMap.get(d.lodging_id);
    if (lodging) fixedNet += num(lodging.net_price_per_night);
  }

  // Lodging cost for the gap day (kept; only experiences are replaced)
  const gapLodging = lodgingMap.get(gapDay.lodging_id);
  const gapLodgingCost = gapLodging ? num(gapLodging.net_price_per_night) : 0;

  const inboundTransferMin =
    gapIdx0 > 0
      ? getTransferMin(paidItinerary.days[gapIdx0 - 1].zone_id, gapDay.zone_id, transferMap)
      : 0;

  const dayStartMin = isFirstDay
    ? parseTime(arrivalTime)
    : DEFAULT_DAY_START_MIN + inboundTransferMin;
  const dayEndMin = isLastDay ? parseTime(departureTime) : DEFAULT_DAY_END_MIN;

  // Available experience budget for the gap day
  const paceMaxExp: Record<string, number> = { relaxed: 2, moderate: 3, packed: 4 };
  const maxExpPerDay = paceMaxExp[pace] ?? 3;

  const available = candidatePool.filter((e) => {
    if (usedIds.has(e.id)) return false;
    if (!isOpenOnDay(e, date)) return false;
    const ifAdded = applyMarkup(fixedNet + gapLodgingCost + num(e.net_price) * travelers);
    return ifAdded <= budgetTotal;
  });

  if (available.length === 0) {
    return { replacement: null, reason: "No available experiences fit the gap constraints" };
  }

  const sorted = [...available].sort((a, b) => {
    const ai = interests.includes(a.category) ? 0 : 1;
    const bi2 = interests.includes(b.category) ? 0 : 1;
    return ai - bi2;
  });

  const { scheduledExps, totalTransferMin } = fillDay(
    date,
    dayStartMin,
    dayEndMin,
    gapDay.zone_id,
    noEarly,
    sorted,
    transferMap,
    maxExpPerDay
  );

  if (scheduledExps.length === 0) {
    return {
      replacement: null,
      reason: "No experiences could be scheduled in the available time window",
    };
  }

  // Build repaired snapshot
  const newDays: ItineraryDay[] = paidItinerary.days.map((d, di) => {
    if (di !== gapIdx0) return d;
    return {
      day_index: d.day_index,
      zone_id: d.zone_id,
      lodging_id: d.lodging_id,
      experiences: scheduledExps.map(({ experience, startMin, endMin }) => ({
        experience_id: experience.id,
        start_time: formatTime(startMin),
        end_time: formatTime(endMin),
      })),
      transfer_in_minutes: inboundTransferMin,
    };
  });

  let newNet = fixedNet + gapLodgingCost;
  for (const { experience } of scheduledExps) newNet += num(experience.net_price) * travelers;

  // Rebuild DayPlans for scoring
  const allDayPlans: DayPlan[] = newDays.map((d, di) => {
    const items: ScheduledItem[] = d.experiences.map((se) => {
      const exp =
        expMap.get(se.experience_id) ??
        candidatePool.find((e) => e.id === se.experience_id);
      return {
        experience: exp!,
        startMin: parseTime(se.start_time),
        endMin: parseTime(se.end_time),
      };
    }).filter((item) => item.experience != null);

    return {
      dayIndex: d.day_index,
      date: dates[di] ?? date,
      zoneId: d.zone_id,
      lodgingId: d.lodging_id,
      scheduledExperiences: items,
      totalTransferMin: di === gapIdx0 ? totalTransferMin : 0,
      inboundTransferMin: d.transfer_in_minutes,
    };
  });

  const scores = scoreItinerary(allDayPlans, interests, pace, weights);

  return {
    replacement: {
      days: newDays,
      net_total: round2(newNet),
      client_total: round2(applyMarkup(newNet)),
      scores,
    },
  };
}

// ─── Validity checker (exported for testing) ──────────────────────────────────

export function checkValidity(
  snapshot: ItinerarySnapshot,
  problem: AssembleProblem
): ValidityResult {
  const violations: string[] = [];
  const transferMap = buildTransferMap(problem.transferMatrix);
  const expMap = new Map(problem.candidatePool.map((e) => [e.id, e]));
  const lodgingMap = new Map(problem.lodgingPool.map((l) => [l.id, l]));
  const numDays = problem.dates.length;
  const noEarly = problem.mornings === "no_early";

  for (let di = 0; di < snapshot.days.length; di++) {
    const day = snapshot.days[di];
    const date = problem.dates[di] ?? problem.dates[numDays - 1];
    const isFirstDay = di === 0;
    const isLastDay = di === numDays - 1;

    const dayStartMin = isFirstDay
      ? parseTime(problem.arrivalTime)
      : DEFAULT_DAY_START_MIN;
    const dayEndMin = isLastDay
      ? parseTime(problem.departureTime)
      : DEFAULT_DAY_END_MIN;

    if (!lodgingMap.has(day.lodging_id)) {
      violations.push(`Day ${day.day_index}: lodging ${day.lodging_id} not found`);
    }

    for (const se of day.experiences) {
      const exp = expMap.get(se.experience_id);
      if (!exp) {
        violations.push(
          `Day ${day.day_index}: experience ${se.experience_id} not in candidate pool`
        );
        continue;
      }

      const startMin = parseTime(se.start_time);
      const endMin = parseTime(se.end_time);

      if (noEarly && startMin < NO_EARLY_THRESHOLD_MIN) {
        violations.push(
          `Day ${day.day_index}: ${exp.name} starts before no-early-mornings threshold`
        );
      }
      if (startMin < dayStartMin) {
        violations.push(`Day ${day.day_index}: ${exp.name} starts before day window open`);
      }
      if (endMin > dayEndMin) {
        violations.push(`Day ${day.day_index}: ${exp.name} ends after day window close`);
      }
      if (!isOpenOnDay(exp, date)) {
        violations.push(`Day ${day.day_index}: ${exp.name} is closed on ${date}`);
      }
      if (
        startMin < parseTime(exp.open_from) ||
        endMin > parseTime(exp.open_to)
      ) {
        violations.push(
          `Day ${day.day_index}: ${exp.name} outside its own operating hours`
        );
      }
      if (!dependencyAllowed(exp, startMin, noEarly)) {
        violations.push(
          `Day ${day.day_index}: ${exp.name} dependency not met at ${se.start_time}`
        );
      }
    }

    // Transfer feasibility between consecutive days
    if (di > 0) {
      const prevZone = snapshot.days[di - 1].zone_id;
      const inbound = getTransferMin(prevZone, day.zone_id, transferMap);
      if (dayStartMin + inbound > dayEndMin) {
        violations.push(
          `Day ${day.day_index}: inbound transfer (${inbound} min) exceeds available day window`
        );
      }
    }
  }

  if (snapshot.client_total > problem.budgetTotal) {
    violations.push(
      `Client total $${snapshot.client_total} exceeds budget $${problem.budgetTotal}`
    );
  }

  return { valid: violations.length === 0, violations };
}
