// Rumbo · SBI-07: DB access for the booking lifecycle.
import crypto from "crypto";
import { getPool } from "../db/pool";
import { ClientRequest, ItinerarySnapshot, Order, OrderItem } from "../types";
import { ExtractionOutput } from "../llm";
import { IntakeInput, HOLD_WINDOW_MINUTES } from "./types";

/** Non-guessable token: 32 bytes of CSPRNG, hex-encoded. */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** node-postgres returns `date` columns as JS Date objects; normalize to 'YYYY-MM-DD'. */
function toDateString(value: string | Date): string {
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

function toClientRequest(row: any): ClientRequest {
  return {
    id: row.id,
    token: row.token,
    email: row.email,
    arrival_date: toDateString(row.arrival_date),
    departure_date: toDateString(row.departure_date),
    arrival_time: row.arrival_time,
    departure_time: row.departure_time,
    travelers: Number(row.travelers),
    budget_total: Number(row.budget_total),
    prefs_json: row.prefs_json,
    free_text: row.free_text,
    status: row.status,
    created_at: row.created_at,
  };
}

export async function insertClientRequest(intake: IntakeInput): Promise<{ id: string; token: string }> {
  const pool = getPool();
  const token = generateToken();
  const { rows } = await pool.query(
    `INSERT INTO client_requests
       (token, email, arrival_date, departure_date, arrival_time, departure_time,
        travelers, budget_total, prefs_json, free_text, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'building')
     RETURNING id`,
    [
      token,
      intake.email,
      intake.arrival_date,
      intake.departure_date,
      intake.arrival_time,
      intake.departure_time,
      intake.travelers,
      intake.budget_total,
      JSON.stringify(intake.prefs_json),
      intake.free_text,
    ]
  );
  return { id: rows[0].id, token };
}

export async function getRequestById(id: string): Promise<ClientRequest | null> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM client_requests WHERE id = $1`, [id]);
  return rows[0] ? toClientRequest(rows[0]) : null;
}

export async function getRequestByToken(token: string): Promise<ClientRequest | null> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM client_requests WHERE token = $1`, [token]);
  return rows[0] ? toClientRequest(rows[0]) : null;
}

export async function saveExtraction(requestId: string, extraction: ExtractionOutput): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE client_requests SET extraction_json = $2 WHERE id = $1`, [
    requestId,
    JSON.stringify(extraction),
  ]);
}

export async function setRequestStatus(
  requestId: string,
  status: "building" | "proposals_ready" | "paid" | "expired"
): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE client_requests SET status = $2 WHERE id = $1`, [requestId, status]);
}

// ─── Proposal cache (ephemeral hold) ──────────────────────────────────────

export async function saveProposals(
  requestId: string,
  token: string,
  proposals: ItinerarySnapshot[]
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO proposal_cache (request_id, token, proposals_json)
     VALUES ($1, $2, $3)
     ON CONFLICT (request_id) DO UPDATE SET proposals_json = EXCLUDED.proposals_json`,
    [requestId, token, JSON.stringify(proposals)]
  );
}

interface ProposalCacheRow {
  request_id: string;
  token: string;
  proposals_json: ItinerarySnapshot[];
  first_viewed_at: string | null;
  expires_at: string | null;
}

export async function getProposalCache(token: string): Promise<ProposalCacheRow | null> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM proposal_cache WHERE token = $1`, [token]);
  return rows[0] ?? null;
}

/**
 * Starts the 15-minute hold on first read. Idempotent: a second call
 * within the window does not reset the timer.
 */
export async function markViewedIfFirst(token: string): Promise<ProposalCacheRow | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE proposal_cache
     SET first_viewed_at = COALESCE(first_viewed_at, now()),
         expires_at = COALESCE(expires_at, now() + ($2 || ' minutes')::interval)
     WHERE token = $1
     RETURNING *`,
    [token, HOLD_WINDOW_MINUTES]
  );
  return rows[0] ?? null;
}

// ─── Orders / order_items ─────────────────────────────────────────────────

export interface NewOrderItem {
  item_type: "experience" | "lodging";
  ref_id: string;
  day_index: number;
  net_price: number;
}

export async function insertOrder(
  requestId: string,
  itinerary: ItinerarySnapshot,
  providerInstructions: unknown[],
  items: NewOrderItem[]
): Promise<string> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO orders (request_id, chosen_itinerary_json, client_price, provider_instructions_json)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [requestId, JSON.stringify(itinerary), itinerary.client_total, JSON.stringify(providerInstructions)]
    );
    const orderId = rows[0].id;
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, item_type, ref_id, day_index, net_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.item_type, item.ref_id, item.day_index, item.net_price]
      );
    }
    await client.query(`UPDATE client_requests SET status = 'paid' WHERE id = $1`, [requestId]);
    await client.query("COMMIT");
    return orderId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getOrderItemsForExperience(experienceId: string): Promise<
  Array<{ day_index: number; arrival_date: string; travelers: number }>
> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT oi.day_index, cr.arrival_date, cr.travelers
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN client_requests cr ON o.request_id = cr.id
     WHERE oi.item_type = 'experience' AND oi.ref_id = $1 AND oi.status = 'booked'`,
    [experienceId]
  );
  return rows.map((r: any) => ({
    day_index: Number(r.day_index),
    arrival_date: toDateString(r.arrival_date),
    travelers: Number(r.travelers),
  }));
}
