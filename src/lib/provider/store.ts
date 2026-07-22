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
     WHERE status IN ('building', 'awaiting_providers', 'proposals_ready')
     ORDER BY created_at DESC
     LIMIT 40`
  );
  return rows.map((r) => ({
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

export type ResponseStatus = "pending" | "confirmed" | "declined";

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
 * Phase 1: create one PENDING availability request per matched experience.
 * Batched into a single INSERT. Idempotent per (request, experience): re-running
 * leaves any already-recorded row untouched.
 */
export async function insertPendingRequests(
  rows: Array<{ requestId: string; experienceId: string; providerId: string; netRate: number }>
): Promise<void> {
  if (rows.length === 0) return;
  const pool = getPool();
  const values: string[] = [];
  const params: unknown[] = [];
  rows.forEach((r, i) => {
    const b = i * 4;
    values.push(`($${b + 1}, $${b + 2}, $${b + 3}, 'pending', $${b + 4})`);
    params.push(r.requestId, r.experienceId, r.providerId, r.netRate);
  });
  await pool.query(
    `INSERT INTO provider_responses (request_id, experience_id, provider_id, status, net_rate)
     VALUES ${values.join(", ")}
     ON CONFLICT (request_id, experience_id) DO NOTHING`,
    params
  );
}

/** Phase 2: the availability requests still awaiting a response for a request. */
export async function getPendingForRequest(
  requestId: string
): Promise<Array<{ experience_id: string; provider_id: string; net_rate: number }>> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT experience_id, provider_id, net_rate
     FROM provider_responses
     WHERE request_id = $1 AND status = 'pending'`,
    [requestId]
  );
  return rows.map((r: any) => ({
    experience_id: r.experience_id,
    provider_id: r.provider_id,
    net_rate: Number(r.net_rate),
  }));
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

/**
 * Resolve a single availability request to confirmed/declined. Used both by the
 * simulated responder (Phase 2) and by a human accepting/declining in the
 * portal. The NET rate (provider total) is passed in — never a client price.
 */
export async function resolveResponse(params: {
  requestId: string;
  experienceId: string;
  providerId: string;
  decision: "confirmed" | "declined";
  netRate: number;
}): Promise<void> {
  const pool = getPool();
  // Upsert so a manual portal decision still works even if no pending row exists.
  await pool.query(
    `INSERT INTO provider_responses (request_id, experience_id, provider_id, status, net_rate, decided_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (request_id, experience_id)
     DO UPDATE SET status = EXCLUDED.status,
                   net_rate = EXCLUDED.net_rate, decided_at = now()`,
    [params.requestId, params.experienceId, params.providerId, params.decision, params.netRate]
  );
}
