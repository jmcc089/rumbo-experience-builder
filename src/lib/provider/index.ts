// Rumbo · SBI-11: provider portal public service surface.
//
// Builds the acting provider's request inbox by matching actively-coordinated
// client requests (SBI-07 lifecycle) against that provider's experiences —
// the same coarse match used by the assembly pipeline (category, open-days
// overlap, loose budget sanity). Confirm/decline is persisted via the store.
//
// EVERYTHING the client-facing price implies (budget, markup, client_total) is
// kept server-side; the view models below expose only the provider NET rate.
import {
  ActiveRequestRow,
  getActiveRequests,
  getProvider,
  getProviderExperiences,
  getResponsesForProvider,
  resolveResponse,
  listProviders,
  ProviderRow,
} from "./store";

/** How long a provider has to respond before the window is treated as closed. */
export const RESPONSE_WINDOW_MINUTES = 10;

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

  const expById = new Map(experiences.map((e) => [e.id, e]));
  const reqById = new Map<string, ActiveRequestRow>(requests.map((r) => [r.id, r]));

  // Pending = real availability-request rows still awaiting this provider's
  // decision (created in Phase 1). No on-the-fly matching anymore.
  const pending: AvailabilityRequest[] = [];
  for (const r of responses) {
    if (r.status !== "pending") continue;
    const exp = expById.get(r.experience_id);
    const req = reqById.get(r.request_id);
    if (!exp || !req) continue; // request no longer active or exp not owned
    const requested = new Date(r.requested_at);
    const expires = new Date(requested.getTime() + RESPONSE_WINDOW_MINUTES * 60_000);
    pending.push({
      requestId: r.request_id,
      experienceId: r.experience_id,
      ticket: ticketRef(r.request_id, r.experience_id),
      serviceName: exp.name,
      date: req.arrival_date,
      time: exp.open_from.slice(0, 5),
      travelers: req.travelers,
      netRatePerPerson: exp.net_price,
      netRateTotal: r.net_rate,
      createdAt: requested.toISOString(),
      windowExpiresAt: expires.toISOString(),
    });
  }

  // Live requests (window still open) first, then most recent.
  const now = Date.now();
  pending.sort((a, b) => {
    const aLive = new Date(a.windowExpiresAt).getTime() > now ? 0 : 1;
    const bLive = new Date(b.windowExpiresAt).getTime() > now ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const history: HistoryItem[] = responses
    .filter((r) => r.status !== "pending" && r.decided_at != null)
    .map((r) => {
      const exp = expById.get(r.experience_id);
      return {
        requestId: r.request_id,
        experienceId: r.experience_id,
        ticket: ticketRef(r.request_id, r.experience_id),
        serviceName: exp?.name ?? r.experience_id,
        date: r.decided_at!.slice(0, 10),
        travelers: exp ? Math.max(1, Math.round(r.net_rate / exp.net_price)) : 1,
        decision: r.status as "confirmed" | "declined",
        netRateTotal: r.net_rate,
        decidedAt: r.decided_at!,
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
  await resolveResponse({ providerId, requestId, experienceId, decision, netRate });
  return { ok: true };
}
