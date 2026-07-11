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
  return rows.map((r: any) => ({
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
  return rows.map((r: any) => ({
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

export interface ActiveRequestRow {
  id: string;
  arrival_date: string;
  departure_date: string;
  travelers: number;
  budget_total: number;
  interests: string[];
  created_at: string;
}

/**
 * Client requests still being coordinated (building / proposals_ready). Only
 * the logistics the provider needs are read — the client's identity and price
 * are intentionally NOT selected here.
 */
export async function getActiveRequests(): Promise<ActiveRequestRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, arrival_date, departure_date, travelers, budget_total, prefs_json, created_at
     FROM client_requests
     WHERE status IN ('building', 'proposals_ready')
     ORDER BY created_at DESC
     LIMIT 40`
  );
  return rows.map((r: any) => ({
    id: r.id,
    arrival_date: toDateString(r.arrival_date),
    departure_date: toDateString(r.departure_date),
    travelers: Number(r.travelers),
    // budget_total is read only for the server-side match filter and is never
    // returned past the lib layer.
    budget_total: Number(r.budget_total),
    interests: Array.isArray(r.prefs_json?.interests) ? r.prefs_json.interests : [],
    created_at:
      typeof r.created_at === "string" ? r.created_at : r.created_at.toISOString(),
  }));
}

export interface ProviderResponseRow {
  request_id: string;
  experience_id: string;
  decision: "confirmed" | "declined";
  net_rate: number;
  decided_at: string;
}

/** All stored responses for a provider (used to split inbox vs. history). */
export async function getResponsesForProvider(providerId: string): Promise<ProviderResponseRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT request_id, experience_id, decision, net_rate, decided_at
     FROM provider_responses
     WHERE provider_id = $1
     ORDER BY decided_at DESC`,
    [providerId]
  );
  return rows.map((r: any) => ({
    request_id: r.request_id,
    experience_id: r.experience_id,
    decision: r.decision,
    net_rate: Number(r.net_rate),
    decided_at:
      typeof r.decided_at === "string" ? r.decided_at : r.decided_at.toISOString(),
  }));
}

/**
 * Persist a confirm/decline. Idempotent per (request, experience): a second
 * response overwrites the first (a provider can change their mind in the demo).
 * The caller passes the NET rate (provider total) — never a client price.
 */
export async function insertResponse(params: {
  requestId: string;
  experienceId: string;
  providerId: string;
  decision: "confirmed" | "declined";
  netRate: number;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO provider_responses (request_id, experience_id, provider_id, decision, net_rate)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (request_id, experience_id)
     DO UPDATE SET decision = EXCLUDED.decision, net_rate = EXCLUDED.net_rate, decided_at = now()`,
    [params.requestId, params.experienceId, params.providerId, params.decision, params.netRate]
  );
}
