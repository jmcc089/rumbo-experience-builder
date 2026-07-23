// Rumbo · SBI-07: public booking service — the surface client-portal SBIs call.
import { getPool } from "../db/pool";
import { ItinerarySnapshot, ProviderPersonalization } from "../types";
import { generateProviderInstructions, OrderProviderInstructions } from "../llm";
import {
  getProposalCache,
  getRequestByToken,
  getRequestsPastWindow,
  insertClientRequest,
  insertOrder,
  markViewedIfFirst,
  NewOrderItem,
  setRequestStatus,
} from "./store";
import { startAvailabilityRequests, finalizeProposals } from "./pipeline";
import { sendAcknowledgment, sendPurchaseConfirmation, OrderSummary } from "../email";
import {
  ConfirmAndPayResult,
  CreateRequestResult,
  IntakeInput,
  PayHooks,
  PipelineHooks,
  ProposalsView,
} from "./types";

export { HOLD_WINDOW_MINUTES } from "./types";
export type { IntakeInput, ProposalsView, ConfirmAndPayResult, PipelineHooks, PayHooks } from "./types";

/** Persists the intake and returns a non-guessable token. Does NOT run the pipeline. */
export async function createRequest(intake: IntakeInput): Promise<CreateRequestResult> {
  const result = await insertClientRequest(intake);
  // SBI-08 trigger (email 1): confirms the intake was received. No link, no action.
  await sendAcknowledgment(intake.email);
  return result;
}

/**
 * Phase 1 (fires from intake via `after()`): match the catalog and send a
 * pending availability request to every matching provider, then open the
 * acceptance window. Proposals are built later by the cron finalizer.
 */
export async function runRequestPipeline(requestId: string): Promise<void> {
  await startAvailabilityRequests(requestId);
}

/** Phase 2: finalize one request whose acceptance window has closed. */
export async function finalizeRequestProposals(
  requestId: string,
  hooks?: PipelineHooks
): Promise<void> {
  await finalizeProposals(requestId, hooks);
}

/** Ids of requests whose acceptance window has closed (for the cron poller). */
export async function getDueRequestIds(): Promise<string[]> {
  return getRequestsPastWindow();
}

/** Retrieves the 3 proposals for a token. Starts the 15-min hold on first call. */
export async function getProposals(token: string): Promise<ProposalsView> {
  const cache = await getProposalCache(token);
  if (!cache) return { status: "not_found" };

  const request = await getRequestByToken(token);
  if (!request) return { status: "not_found" };

  if (request.status === "expired") return { status: "expired" };
  if (request.status !== "proposals_ready" && request.status !== "paid") {
    return { status: "not_ready" };
  }

  const viewed = await markViewedIfFirst(token);
  const expiresAt = viewed?.expires_at ?? cache.expires_at;

  if (expiresAt && new Date(expiresAt).getTime() < Date.now() && request.status !== "paid") {
    await setRequestStatus(request.id, "expired");
    return { status: "expired" };
  }

  return {
    status: "ready",
    proposals: (viewed?.proposals_json ?? cache.proposals_json) as ItinerarySnapshot[],
    expiresAt: expiresAt ?? undefined,
  };
}

async function providersUsedInItinerary(itinerary: ItinerarySnapshot): Promise<
  Map<string, ProviderPersonalization>
> {
  const pool = getPool();
  const experienceIds = new Set<string>();
  for (const day of itinerary.days) {
    for (const exp of day.experiences) experienceIds.add(exp.experience_id);
  }
  if (experienceIds.size === 0) return new Map();

  const { rows } = await pool.query(
    `SELECT e.id as experience_id, pp.*
     FROM experiences e
     JOIN provider_personalization pp ON pp.provider_id = e.provider_id
     WHERE e.id = ANY($1)`,
    [Array.from(experienceIds)]
  );

  const byProvider = new Map<string, ProviderPersonalization>();
  for (const row of rows) {
    byProvider.set(row.provider_id, {
      provider_id: row.provider_id,
      special_occasions: row.special_occasions,
      dietary_options: row.dietary_options,
      privacy_options: row.privacy_options,
      extras_on_request: row.extras_on_request,
    });
  }
  return byProvider;
}

async function buildOrderSummary(itinerary: ItinerarySnapshot): Promise<OrderSummary> {
  const pool = getPool();
  const experienceIds = new Set<string>();
  const lodgingIds = new Set<string>();
  const zoneIds = new Set<string>();
  for (const day of itinerary.days) {
    lodgingIds.add(day.lodging_id);
    zoneIds.add(day.zone_id);
    for (const exp of day.experiences) experienceIds.add(exp.experience_id);
  }

  const [expRes, lodgingRes, zoneRes] = await Promise.all([
    experienceIds.size
      ? pool.query(`SELECT id, name FROM experiences WHERE id = ANY($1)`, [Array.from(experienceIds)])
      : Promise.resolve({ rows: [] }),
    lodgingIds.size
      ? pool.query(`SELECT id, name FROM lodging WHERE id = ANY($1)`, [Array.from(lodgingIds)])
      : Promise.resolve({ rows: [] }),
    zoneIds.size
      ? pool.query(`SELECT id, name FROM zones WHERE id = ANY($1)`, [Array.from(zoneIds)])
      : Promise.resolve({ rows: [] }),
  ]);

  const expName = new Map<string, string>(expRes.rows.map((r) => [r.id, r.name]));
  const lodgingName = new Map<string, string>(lodgingRes.rows.map((r) => [r.id, r.name]));
  const zoneName = new Map<string, string>(zoneRes.rows.map((r) => [r.id, r.name]));

  return {
    days: itinerary.days.map((day) => ({
      day_index: day.day_index,
      zone_name: zoneName.get(day.zone_id) ?? day.zone_id,
      lodging_name: lodgingName.get(day.lodging_id) ?? day.lodging_id,
      experience_names: day.experiences.map((exp) => expName.get(exp.experience_id) ?? exp.experience_id),
    })),
    client_total: itinerary.client_total,
  };
}

async function buildOrderItems(itinerary: ItinerarySnapshot, travelers: number): Promise<NewOrderItem[]> {
  const pool = getPool();
  const experienceIds = new Set<string>();
  const lodgingIds = new Set<string>();
  for (const day of itinerary.days) {
    lodgingIds.add(day.lodging_id);
    for (const exp of day.experiences) experienceIds.add(exp.experience_id);
  }

  const [expRes, lodgingRes] = await Promise.all([
    experienceIds.size
      ? pool.query(`SELECT id, net_price FROM experiences WHERE id = ANY($1)`, [Array.from(experienceIds)])
      : Promise.resolve({ rows: [] }),
    lodgingIds.size
      ? pool.query(`SELECT id, net_price_per_night FROM lodging WHERE id = ANY($1)`, [Array.from(lodgingIds)])
      : Promise.resolve({ rows: [] }),
  ]);

  const expNetPrice = new Map<string, number>(expRes.rows.map((r) => [r.id, Number(r.net_price)]));
  const lodgingNetPrice = new Map<string, number>(
    lodgingRes.rows.map((r) => [r.id, Number(r.net_price_per_night)])
  );

  const items: NewOrderItem[] = [];
  for (const day of itinerary.days) {
    items.push({
      item_type: "lodging",
      ref_id: day.lodging_id,
      day_index: day.day_index,
      net_price: lodgingNetPrice.get(day.lodging_id) ?? 0,
    });
    for (const exp of day.experiences) {
      items.push({
        item_type: "experience",
        ref_id: exp.experience_id,
        day_index: day.day_index,
        net_price: (expNetPrice.get(exp.experience_id) ?? 0) * travelers,
      });
    }
  }
  return items;
}

/** Materializes the chosen itinerary to orders + order_items within the hold window. */
export async function confirmAndPay(
  token: string,
  chosenIndex: number,
  hooks: PayHooks = {}
): Promise<ConfirmAndPayResult> {
  const cache = await getProposalCache(token);
  const request = await getRequestByToken(token);
  if (!cache || !request) return { status: "not_found" };

  if (request.status === "expired") return { status: "expired" };

  const viewed = await markViewedIfFirst(token);
  const expiresAt = viewed?.expires_at ?? cache.expires_at;
  if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
    await setRequestStatus(request.id, "expired");
    return { status: "expired" };
  }

  const proposals = (viewed?.proposals_json ?? cache.proposals_json) as ItinerarySnapshot[];
  const itinerary = proposals[chosenIndex];
  if (!itinerary) return { status: "invalid_choice" };

  const [items, providersByPersonalization] = await Promise.all([
    buildOrderItems(itinerary, request.travelers),
    providersUsedInItinerary(itinerary),
  ]);

  const pool = getPool();
  const { rows } = await pool.query(`SELECT extraction_json FROM client_requests WHERE id = $1`, [request.id]);
  const notes: string[] = rows[0]?.extraction_json?.personalization_notes ?? [];

  const providerInstructions: OrderProviderInstructions[] = [];
  for (const [providerId, personalization] of providersByPersonalization) {
    const instructions = await generateProviderInstructions(notes, personalization);
    if (instructions.length) providerInstructions.push({ provider_id: providerId, instructions });
  }

  const orderId = await insertOrder(request.id, itinerary, providerInstructions, items);

  // SBI-08 trigger (email 3): purchase confirmation / receipt.
  const summary = await buildOrderSummary(itinerary);
  await sendPurchaseConfirmation(request.email, summary, token);

  await hooks.notifyOrderConfirmed?.({
    requestId: request.id,
    email: request.email,
    orderId,
    itinerary,
  });

  return { status: "paid", orderId, itinerary, providerInstructions };
}
