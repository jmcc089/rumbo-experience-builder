// Rumbo · SBI-13: DB access for post-booking repair.
import { getPool } from "../db/pool";
import { ClientPrefs, ItinerarySnapshot } from "../types";

function toDateString(value: string | Date): string {
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

export interface OrderRow {
  id: string;
  request_id: string;
  chosen_itinerary_json: ItinerarySnapshot;
  client_price: number;
}

export async function getOrderById(orderId: string): Promise<OrderRow | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, request_id, chosen_itinerary_json, client_price FROM orders WHERE id = $1`,
    [orderId]
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    request_id: rows[0].request_id,
    chosen_itinerary_json: rows[0].chosen_itinerary_json,
    client_price: Number(rows[0].client_price),
  };
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  item_type: "experience" | "lodging";
  ref_id: string;
  day_index: number;
  net_price: number;
  status: "booked" | "disrupted" | "replaced";
}

export async function getOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, order_id, item_type, ref_id, day_index, net_price, status
     FROM order_items WHERE order_id = $1 ORDER BY day_index, item_type`,
    [orderId]
  );
  return rows.map((r: any) => ({
    id: r.id,
    order_id: r.order_id,
    item_type: r.item_type,
    ref_id: r.ref_id,
    day_index: Number(r.day_index),
    net_price: Number(r.net_price),
    status: r.status,
  }));
}

/**
 * Experience order_items joined with their provider's reliability_score —
 * the weighting input for the disruption generator.
 */
export interface DisruptibleItem {
  order_item_id: string;
  experience_id: string;
  day_index: number;
  provider_id: string;
  reliability_score: number;
}

export async function getDisruptibleItems(orderId: string): Promise<DisruptibleItem[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT oi.id AS order_item_id, oi.ref_id AS experience_id, oi.day_index,
            e.provider_id, p.reliability_score
     FROM order_items oi
     JOIN experiences e ON e.id = oi.ref_id
     JOIN providers p ON p.id = e.provider_id
     WHERE oi.order_id = $1 AND oi.item_type = 'experience' AND oi.status = 'booked'
     ORDER BY oi.day_index, oi.id`,
    [orderId]
  );
  return rows.map((r: any) => ({
    order_item_id: r.order_item_id,
    experience_id: r.experience_id,
    day_index: Number(r.day_index),
    provider_id: r.provider_id,
    reliability_score: Number(r.reliability_score),
  }));
}

export async function markItemDisrupted(orderItemId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE order_items SET status = 'disrupted' WHERE id = $1`, [orderItemId]);
}

export interface RequestContext {
  request_id: string;
  arrival_date: string;
  departure_date: string;
  arrival_time: string;
  departure_time: string;
  travelers: number;
  budget_total: number;
  prefs_json: ClientPrefs;
}

export async function getRequestContextForOrder(orderId: string): Promise<RequestContext | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT cr.id AS request_id, cr.arrival_date, cr.departure_date, cr.arrival_time,
            cr.departure_time, cr.travelers, cr.budget_total, cr.prefs_json
     FROM orders o JOIN client_requests cr ON cr.id = o.request_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    request_id: r.request_id,
    arrival_date: toDateString(r.arrival_date),
    departure_date: toDateString(r.departure_date),
    arrival_time: r.arrival_time,
    departure_time: r.departure_time,
    travelers: Number(r.travelers),
    budget_total: Number(r.budget_total),
    prefs_json: r.prefs_json,
  };
}

/**
 * Applies a successful repair: the gap day's old experience items become
 * 'replaced', the new day's experiences are inserted as fresh 'booked' rows,
 * and the order's itinerary snapshot + client_price are updated to the
 * recomputed (possibly different) totals — price differences from the
 * replacement are reflected directly in the order, not absorbed silently.
 */
export async function applyRepair(
  orderId: string,
  gapDayIndex: number,
  replacement: ItinerarySnapshot
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE order_items SET status = 'replaced'
       WHERE order_id = $1 AND day_index = $2 AND item_type = 'experience' AND status IN ('booked', 'disrupted')`,
      [orderId, gapDayIndex]
    );
    const gapDay = replacement.days.find((d) => d.day_index === gapDayIndex);
    for (const se of gapDay?.experiences ?? []) {
      const exp = await client.query(`SELECT net_price FROM experiences WHERE id = $1`, [se.experience_id]);
      const netPricePerPerson = Number(exp.rows[0]?.net_price ?? 0);
      const travelersRes = await client.query(
        `SELECT cr.travelers FROM orders o JOIN client_requests cr ON cr.id = o.request_id WHERE o.id = $1`,
        [orderId]
      );
      const travelers = Number(travelersRes.rows[0]?.travelers ?? 1);
      await client.query(
        `INSERT INTO order_items (order_id, item_type, ref_id, day_index, net_price, status)
         VALUES ($1, 'experience', $2, $3, $4, 'booked')`,
        [orderId, se.experience_id, gapDayIndex, netPricePerPerson * travelers]
      );
    }
    await client.query(
      `UPDATE orders SET chosen_itinerary_json = $2, client_price = $3 WHERE id = $1`,
      [orderId, JSON.stringify(replacement), replacement.client_total]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
