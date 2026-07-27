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
  getProvider,
  getProviderExperiences,
  getProviderBookedServices,
  getProviderCatalog,
  getProviderProfile,
  getResponsesForProvider,
  listProviders,
  ProviderRow,
} from "./store";

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
  history: HistoryItem[];
}

export type { ProviderRow, ProviderExperienceRow, ProviderProfileRow } from "./store";
export { listProviders, getProviderCatalog, getProviderProfile };

function ticketRef(requestId: string, experienceId: string): string {
  // A short, stable, non-sensitive reference for the card header.
  const a = requestId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const b = experienceId.replace(/[^a-z0-9]/gi, "").slice(-3).toUpperCase();
  return `RQ-${a}-${b}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A confirmed, paid job the provider must deliver, shown in "Booked services". */
export interface BookedService {
  orderItemId: string;
  orderId: string;
  ticket: string;
  serviceName: string;
  date: string; // 'YYYY-MM-DD' — arrival day + day_index
  time: string; // 'HH:MM' — the experience's opening slot
  travelers: number;
  netRateTotal: number; // what Rumbo pays the provider for the group
}

/**
 * The acting provider's real delivery schedule: experiences that a client
 * actually chose and paid for. Ordered soonest first. NET rate only.
 */
export async function getProviderBookings(providerId: string): Promise<BookedService[]> {
  const rows = await getProviderBookedServices(providerId);
  return rows.map((r) => ({
    orderItemId: r.order_item_id,
    orderId: r.order_id,
    ticket: ticketRef(r.order_id, r.experience_id),
    serviceName: r.service_name,
    date: addDaysIso(r.arrival_date, r.day_index),
    time: r.open_from.slice(0, 5),
    travelers: r.travelers,
    netRateTotal: r.net_price,
  }));
}

/**
 * Build the acting provider's inbox: a read-only history of how each matched
 * request resolved. There is no pending state to show — resolution happens in
 * the same pipeline run as the match, so by the time anyone opens this page
 * every row is already decided.
 */
export async function getProviderInbox(providerId: string): Promise<ProviderInbox | null> {
  const provider = await getProvider(providerId);
  if (!provider) return null;

  const [experiences, responses] = await Promise.all([
    getProviderExperiences(providerId),
    getResponsesForProvider(providerId),
  ]);

  const expById = new Map(experiences.map((e) => [e.id, e]));

  const history: HistoryItem[] = responses
    .filter((r) => r.decided_at != null)
    .map((r) => {
      const exp = expById.get(r.experience_id);
      return {
        requestId: r.request_id,
        experienceId: r.experience_id,
        ticket: ticketRef(r.request_id, r.experience_id),
        serviceName: exp?.name ?? r.experience_id,
        date: r.decided_at!.slice(0, 10),
        travelers: exp ? Math.max(1, Math.round(r.net_rate / exp.net_price)) : 1,
        decision: r.status,
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
    history,
  };
}
