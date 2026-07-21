// Rumbo · SBI-13: post-booking repair.
//
// Repair lives AFTER booking. A paid itinerary can lose a piece (a provider
// falls through). The cause is irrelevant to the engine — it only needs:
// there's a gap, the rest is fixed, find the best valid replacement.
//
// This is a triggered action (operator dashboard / demo), not a daemon —
// there is no always-on monitor in $0 serverless.
import { hashToUnitFloat } from "../availability";
import { repair, RepairProblem, RepairResult } from "../engine";
import { deriveWeights, selectedInterests } from "../llm";
import { ClientPrefs } from "../types";
import { matchFilter, toCandidate, loadTransferMatrix, tripDates } from "../booking/pipeline";
import {
  getOrderById,
  getOrderItems,
  getDisruptibleItems,
  getRequestContextForOrder,
  markItemDisrupted,
  applyRepair,
  DisruptibleItem,
} from "./store";

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface DisruptionResult {
  disrupted: boolean;
  orderItemId?: string;
  experienceId?: string;
  dayIndex?: number;
  providerId?: string;
  reliabilityScore?: number;
  reason?: string;
}

/**
 * Picks one 'booked' experience item to disrupt, weighted by
 * (1 - provider.reliability_score) so low-reliability (informal) providers
 * are disrupted more often than high-reliability (formal) ones. Deterministic
 * for a given order: the pick is a hash of the order id, not Math.random().
 */
export async function disruptOrder(orderId: string): Promise<DisruptionResult> {
  const candidates = await getDisruptibleItems(orderId);
  if (candidates.length === 0) {
    return { disrupted: false, reason: "No bookable experience items left to disrupt on this order" };
  }

  const weights = candidates.map((c) => Math.max(1 - c.reliability_score, 0.01));
  const total = weights.reduce((a, b) => a + b, 0);
  const r = hashToUnitFloat(orderId, "disruption") * total;

  let cumulative = 0;
  let picked: DisruptibleItem = candidates[candidates.length - 1];
  for (let i = 0; i < candidates.length; i++) {
    cumulative += weights[i];
    if (r <= cumulative) {
      picked = candidates[i];
      break;
    }
  }

  await markItemDisrupted(picked.order_item_id);

  return {
    disrupted: true,
    orderItemId: picked.order_item_id,
    experienceId: picked.experience_id,
    dayIndex: picked.day_index,
    providerId: picked.provider_id,
    reliabilityScore: picked.reliability_score,
  };
}

export interface RepairOutcome {
  repaired: boolean;
  dayIndex?: number;
  newClientTotal?: number;
  reason?: string;
}

/**
 * Finds the disrupted order_item on this order and calls the engine's
 * repair() to re-solve that single gap day, holding every other day fixed.
 * On success the order's itinerary + client_price are updated in place
 * (price differences from the replacement are reflected, not absorbed —
 * see store.ts::applyRepair). On failure the item stays 'disrupted' and a
 * clear reason is returned.
 */
export async function repairOrder(orderId: string): Promise<RepairOutcome> {
  const order = await getOrderById(orderId);
  if (!order) return { repaired: false, reason: `Order ${orderId} not found` };

  const allItems = await getOrderItems(orderId);
  const disruptedItem = allItems.find((i) => i.item_type === "experience" && i.status === "disrupted");
  if (!disruptedItem) {
    return { repaired: false, reason: "No disrupted item found on this order — nothing to repair" };
  }

  const ctx = await getRequestContextForOrder(orderId);
  if (!ctx) return { repaired: false, reason: `Request for order ${orderId} not found` };

  const prefs: ClientPrefs = ctx.prefs_json;
  const interests = selectedInterests(prefs);
  const weights = deriveWeights(prefs);

  const { experiences: matched, lodging } = await matchFilter(
    interests,
    ctx.arrival_date,
    ctx.departure_date,
    ctx.budget_total
  );
  // Repair is an urgent re-solve of one disrupted day: use the full matched
  // catalog as candidates (no acceptance simulation here). The disrupted
  // experience itself must not be re-picked as its own replacement.
  const candidatePool = matched
    .filter((e) => e.id !== disruptedItem.ref_id)
    .map(toCandidate);

  const transferMatrix = await loadTransferMatrix();
  const dates = tripDates(ctx.arrival_date, ctx.departure_date);

  const problem: RepairProblem = {
    paidItinerary: order.chosen_itinerary_json,
    gapDayIndex: disruptedItem.day_index,
    travelers: ctx.travelers,
    weights,
    candidatePool,
    transferMatrix,
    lodgingPool: lodging,
    arrivalTime: ctx.arrival_time,
    departureTime: ctx.departure_time,
    dates,
    budgetTotal: ctx.budget_total,
    interests,
    pace: prefs?.pace ?? "moderate",
    mornings: prefs?.mornings ?? "early_ok",
  };

  const result: RepairResult = repair(problem);

  if (!result.replacement) {
    return { repaired: false, reason: result.reason ?? "No valid replacement found" };
  }

  await applyRepair(orderId, disruptedItem.day_index, result.replacement);

  return {
    repaired: true,
    dayIndex: disruptedItem.day_index,
    newClientTotal: result.replacement.client_total,
  };
}
