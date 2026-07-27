// Rumbo · SBI-11: DB access for the provider portal.
//
// The provider portal is the human-visible surface of the simulated
// availability step (SBI-04/07). Its inbox is derived from real, actively
// coordinated client_requests matched to the acting provider's experiences;
// confirm/decline responses are persisted in `provider_responses` so state and
// history survive reloads.
//
// BUSINESS RULE (load-bearing): providers see only their NET rate. This module
// never selects or exposes the client's marked-up price, budget, or the markup.
import { getPool } from "../db/pool";
import { Experience, Provider } from "../types";

/** node-postgres returns `date` columns as JS Date objects; normalize to 'YYYY-MM-DD'. */
function toDateString(value: string | Date): string {
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

export interface ProviderRow extends Provider {
  zone_name: string;
}

/** All providers, with their zone name, for the "acting as" selector. */
export async function listProviders(): Promise<ProviderRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.*, z.name AS zone_name
     FROM providers p
     JOIN zones z ON p.zone_id = z.id
     ORDER BY z.name, p.name`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    zone_id: r.zone_id,
    provider_type: r.provider_type,
    confirmation_mode: r.confirmation_mode,
    reliability_score: Number(r.reliability_score),
    base_popularity: Number(r.base_popularity),
    zone_name: r.zone_name,
  }));
}

export async function getProvider(providerId: string): Promise<ProviderRow | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.*, z.name AS zone_name
     FROM providers p JOIN zones z ON p.zone_id = z.id
     WHERE p.id = $1`,
    [providerId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    zone_id: r.zone_id,
    provider_type: r.provider_type,
    confirmation_mode: r.confirmation_mode,
    reliability_score: Number(r.reliability_score),
    base_popularity: Number(r.base_popularity),
    zone_name: r.zone_name,
  };
}

/** Experiences offered by a single provider. */
export async function getProviderExperiences(providerId: string): Promise<Experience[]> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM experiences WHERE provider_id = $1`, [
    providerId,
  ]);
  return rows.map((r) => ({
    id: r.id,
    provider_id: r.provider_id,
    name: r.name,
    category: r.category,
    zone_id: r.zone_id,
    duration_min: Number(r.duration_min),
    open_days: r.open_days,
    open_from: r.open_from,
    open_to: r.open_to,
    net_price: Number(r.net_price),
    capacity_per_slot: Number(r.capacity_per_slot),
    dependency: r.dependency,
  }));
}

/** A provider's own experience, with all editable fields, for the Services page. */
export interface ProviderExperienceRow {
  id: string;
  name: string;
  category: string;
  zone_id: string;
  zone_name: string;
  duration_min: number;
  open_days: string;
  open_from: string; // 'HH:MM'
  open_to: string; // 'HH:MM'
  net_price: number;
  capacity_per_slot: number;
  dependency: string | null;
}

export async function getProviderCatalog(providerId: string): Promise<ProviderExperienceRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.category, e.zone_id, e.duration_min, e.open_days,
            e.open_from, e.open_to, e.net_price, e.capacity_per_slot, e.dependency,
            z.name AS zone_name
     FROM experiences e
     JOIN zones z ON z.id = e.zone_id
     WHERE e.provider_id = $1
     ORDER BY e.name`,
    [providerId]
  );
  const hhmm = (t: unknown) => String(t ?? "").slice(0, 5);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    zone_id: r.zone_id,
    zone_name: r.zone_name,
    duration_min: Number(r.duration_min),
    open_days: r.open_days,
    open_from: hhmm(r.open_from),
    open_to: hhmm(r.open_to),
    net_price: Number(r.net_price),
    capacity_per_slot: Number(r.capacity_per_slot),
    dependency: r.dependency ?? null,
  }));
}

/** A provider's editable profile: identity, location, and personalization. */
export interface ProviderProfileRow {
  id: string;
  name: string;
  zone_id: string;
  zone_name: string;
  provider_type: ProviderRow["provider_type"];
  confirmation_mode: ProviderRow["confirmation_mode"];
  special_occasions: string;
  dietary_options: string;
  privacy_options: string;
  extras_on_request: string;
}

export async function getProviderProfile(providerId: string): Promise<ProviderProfileRow | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.zone_id, p.provider_type, p.confirmation_mode, z.name AS zone_name,
            pp.special_occasions, pp.dietary_options, pp.privacy_options, pp.extras_on_request
     FROM providers p
     JOIN zones z ON z.id = p.zone_id
     LEFT JOIN provider_personalization pp ON pp.provider_id = p.id
     WHERE p.id = $1`,
    [providerId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    zone_id: r.zone_id,
    zone_name: r.zone_name,
    provider_type: r.provider_type,
    confirmation_mode: r.confirmation_mode,
    special_occasions: r.special_occasions ?? "",
    dietary_options: r.dietary_options ?? "",
    privacy_options: r.privacy_options ?? "",
    extras_on_request: r.extras_on_request ?? "",
  };
}

/**
 * Booked services this provider actually has to deliver: experience order_items
 * still 'booked' inside a PAID order. NET rate only (oi.net_price is the group
 * total). The client's identity and marked-up price are never selected.
 */
export interface BookedServiceRow {
  order_item_id: string;
  order_id: string;
  experience_id: string;
  service_name: string;
  open_from: string;
  day_index: number;
  net_price: number;
  arrival_date: string;
  travelers: number;
}

export async function getProviderBookedServices(providerId: string): Promise<BookedServiceRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT oi.id AS order_item_id, oi.order_id, oi.day_index, oi.net_price,
            e.id AS experience_id, e.name AS service_name, e.open_from,
            cr.arrival_date, cr.travelers
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id AND o.status = 'paid'
     JOIN experiences e ON e.id = oi.ref_id
     JOIN client_requests cr ON cr.id = o.request_id
     WHERE oi.item_type = 'experience' AND oi.status = 'booked' AND e.provider_id = $1
     ORDER BY cr.arrival_date, oi.day_index`,
    [providerId]
  );
  return rows.map((r) => ({
    order_item_id: r.order_item_id,
    order_id: r.order_id,
    experience_id: r.experience_id,
    service_name: r.service_name,
    open_from: r.open_from,
    day_index: Number(r.day_index),
    net_price: Number(r.net_price),
    arrival_date: toDateString(r.arrival_date),
    travelers: Number(r.travelers),
  }));
}

export type ResponseStatus = "confirmed" | "declined";

export interface ProviderResponseRow {
  request_id: string;
  experience_id: string;
  status: ResponseStatus;
  net_rate: number;
  requested_at: string;
  decided_at: string | null;
}

function toIsoOrNull(value: string | Date | null): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

/** All stored responses for a provider (used to split inbox vs. history). */
export async function getResponsesForProvider(providerId: string): Promise<ProviderResponseRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT request_id, experience_id, status, net_rate, requested_at, decided_at
    FROM provider_responses
     WHERE provider_id = $1
     ORDER BY COALESCE(decided_at, requested_at) DESC`,
    [providerId]
  );
  return rows.map((r) => ({
    request_id: r.request_id,
    experience_id: r.experience_id,
    status: r.status,
    net_rate: Number(r.net_rate),
    requested_at: toIsoOrNull(r.requested_at)!,
    decided_at: toIsoOrNull(r.decided_at),
  }));
}

/**
 * Records one already-decided availability response per matched experience,
 * batched into a single INSERT. The decision (confirmed/declined) is rolled by
 * the simulated responder before this is called — there is no pending state:
 * resolution happens in the same pipeline run as the match, not on a later
 * response. Idempotent per (request, experience): re-running on retry leaves
 * any already-recorded row untouched rather than re-rolling it.
 */
export async function insertResolvedResponses(
  rows: Array<{
    requestId: string;
    experienceId: string;
    providerId: string;
    netRate: number;
    decision: "confirmed" | "declined";
  }>
): Promise<void> {
  if (rows.length === 0) return;
  const pool = getPool();
  const values: string[] = [];
  const params: unknown[] = [];
  rows.forEach((r, i) => {
    const b = i * 5;
    values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, now())`);
    params.push(r.requestId, r.experienceId, r.providerId, r.decision, r.netRate);
  });
  await pool.query(
    `INSERT INTO provider_responses (request_id, experience_id, provider_id, status, net_rate, decided_at)
     VALUES ${values.join(", ")}
     ON CONFLICT (request_id, experience_id) DO NOTHING`,
    params
  );
}

/** Experience ids whose provider accepted, for building the candidate pool. */
export async function getConfirmedExperienceIds(requestId: string): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT experience_id FROM provider_responses
     WHERE request_id = $1 AND status = 'confirmed'`,
    [requestId]
  );
  return rows.map((r: any) => r.experience_id);
}
