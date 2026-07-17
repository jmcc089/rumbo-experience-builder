// Rumbo · SBI-11: provider portal public service surface.
//
// Builds the acting provider's request inbox by matching actively-coordinated
// client requests (SBI-07 lifecycle) against that provider's experiences —
// the same coarse match used by the assembly pipeline (category, open-days
// overlap, loose budget sanity). Confirm/decline is persisted via the store.
//
// EVERYTHING the client-facing price implies (budget, markup, client_total) is
// kept server-side; the view models below expose only the provider NET rate.
import { applyMarkup } from "../pricing";
import { Experience } from "../types";
import {
  ActiveRequestRow,
  getActiveRequests,
  getProvider,
  getProviderExperiences,
  getResponsesForProvider,
  insertResponse,
  listProviders,
  ProviderRow,
} from "./store";

/** How long a provider has to respond before it counts as no-response. */
export const RESPONSE_WINDOW_MINUTES = 20;

const DAY_ABBR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function dayOfWeekAbbr(date: string): string {
  return DAY_ABBR[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function tripDayAbbrevs(arrivalDate: string, departureDate: string): Set<string> {
  const out = new Set<string>();
  const cursor = new Date(`${arrivalDate}T00:00:00Z`);
  const end = new Date(`${departureDate}T00:00:00Z`);
  while (cursor <= end) {
    out.add(dayOfWeekAbbr(cursor.toISOString().slice(0, 10)));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Coarse match: same rules the assembly pipeline uses (SBI-07). */
function requestMatchesExperience(req: ActiveRequestRow, exp: Experience): boolean {
  if (req.interests.length && !req.interests.includes(exp.category)) return false;
  const tripDays = tripDayAbbrevs(req.arrival_date, req.departure_date);
  const openDays = exp.open_days.split(",").map((s) => s.trim());
  if (!openDays.some((d) => tripDays.has(d))) return false;
  if (applyMarkup(exp.net_price) > req.budget_total) return false;
  return true;
}

/** A pending availability request shown in the inbox. NET rate only. */
export interface AvailabilityRequest {
  requestId: string;
  experienceId: string;
  ticket: string; // short human-facing reference
  serviceName: string;
  date: string; // 'YYYY-MM-DD' — representative trip date (arrival day)
  time: string; // 'HH:MM' — the experience's opening slot
  travelers: number;
  netRatePerPerson: number;
  netRateTotal: number; // what Rumbo will pay the provider for the group
  createdAt: string; // ISO — countdown anchor
  windowExpiresAt: string; // ISO — createdAt + RESPONSE_WINDOW_MINUTES
}

/** A past decision shown in recent history. */
export interface HistoryItem {
  requestId: string;
  experienceId: string;
  ticket: string;
  serviceName: string;
  date: string;
  travelers: number;
  decision: "confirmed" | "declined";
  netRateTotal: number;
  decidedAt: string; // ISO
}

export interface ProviderInbox {
  provider: {
    id: string;
    name: string;
    zone_name: string;
    provider_type: ProviderRow["provider_type"];
    confirmation_mode: ProviderRow["confirmation_mode"];
  };
  pending: AvailabilityRequest[];
  history: HistoryItem[];
  responseWindowMinutes: number;
}

export type { ProviderRow };
export { listProviders };

function ticketRef(requestId: string, experienceId: string): string {
  // A short, stable, non-sensitive reference for the card header.
  const a = requestId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const b = experienceId.replace(/[^a-z0-9]/gi, "").slice(-3).toUpperCase();
  return `RQ-${a}-${b}`;
}

/**
 * Build the acting provider's inbox: pending availability requests (no stored
 * response yet) and recent history (already answered). Returns null if the
 * provider id is unknown.
 */
export async function getProviderInbox(providerId: string): Promise<ProviderInbox | null> {
  const provider = await getProvider(providerId);
  if (!provider) return null;

  const [experiences, requests, responses] = await Promise.all([
    getProviderExperiences(providerId),
    getActiveRequests(),
    getResponsesForProvider(providerId),
  ]);

  const answered = new Map<string, (typeof responses)[number]>();
  for (const r of responses) answered.set(`${r.request_id}|${r.experience_id}`, r);

  const expById = new Map(experiences.map((e) => [e.id, e]));
  const pending: AvailabilityRequest[] = [];

  for (const req of requests) {
    for (const exp of experiences) {
      if (!requestMatchesExperience(req, exp)) continue;
      const key = `${req.id}|${exp.id}`;
      if (answered.has(key)) continue; // already in history
      const netTotal = exp.net_price * req.travelers;
      const created = new Date(req.created_at);
      const expires = new Date(created.getTime() + RESPONSE_WINDOW_MINUTES * 60_000);
      pending.push({
        requestId: req.id,
        experienceId: exp.id,
        ticket: ticketRef(req.id, exp.id),
        serviceName: exp.name,
        date: req.arrival_date,
        time: exp.open_from.slice(0, 5),
        travelers: req.travelers,
        netRatePerPerson: exp.net_price,
        netRateTotal: netTotal,
        createdAt: created.toISOString(),
        windowExpiresAt: expires.toISOString(),
      });
    }
  }

  // Live requests (window still open) first, then most recent.
  const now = Date.now();
  pending.sort((a, b) => {
    const aLive = new Date(a.windowExpiresAt).getTime() > now ? 0 : 1;
    const bLive = new Date(b.windowExpiresAt).getTime() > now ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const history: HistoryItem[] = responses.map((r) => {
    const exp = expById.get(r.experience_id);
    return {
      requestId: r.request_id,
      experienceId: r.experience_id,
      ticket: ticketRef(r.request_id, r.experience_id),
      serviceName: exp?.name ?? r.experience_id,
      // history keeps its own recorded date via decided_at; the trip date is not
      // re-derived here (the request may have moved on), decided_at is enough.
      date: r.decided_at.slice(0, 10),
      travelers: exp ? Math.max(1, Math.round(r.net_rate / exp.net_price)) : 1,
      decision: r.decision,
      netRateTotal: r.net_rate,
      decidedAt: r.decided_at,
    };
  });

  return {
    provider: {
      id: provider.id,
      name: provider.name,
      zone_name: provider.zone_name,
      provider_type: provider.provider_type,
      confirmation_mode: provider.confirmation_mode,
    },
    pending,
    history,
    responseWindowMinutes: RESPONSE_WINDOW_MINUTES,
  };
}

/**
 * Record a confirm/decline. Re-derives the NET rate server-side from the
 * catalog (never trusts a client-supplied price), guards that the experience
 * really belongs to this provider, then persists.
 */
export async function recordProviderResponse(params: {
  providerId: string;
  requestId: string;
  experienceId: string;
  decision: "confirmed" | "declined";
}): Promise<{ ok: boolean; error?: string }> {
  const { providerId, requestId, experienceId, decision } = params;
  if (decision !== "confirmed" && decision !== "declined") {
    return { ok: false, error: "invalid_decision" };
  }

  const [experiences, requests] = await Promise.all([
    getProviderExperiences(providerId),
    getActiveRequests(),
  ]);
  const exp = experiences.find((e) => e.id === experienceId);
  if (!exp) return { ok: false, error: "experience_not_owned" };
  const req = requests.find((r) => r.id === requestId);
  if (!req) return { ok: false, error: "request_not_active" };

  const netRate = exp.net_price * req.travelers;
  await insertResponse({ providerId, requestId, experienceId, decision, netRate });
  return { ok: true };
}
