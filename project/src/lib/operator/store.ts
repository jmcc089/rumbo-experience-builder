// Rumbo · SBI-12: read-only DB access for the operator dashboard.
//
// This is Rumbo's OWN internal view. Unlike the client and provider surfaces,
// margin/markup figures ARE allowed here (it is the operator's own business
// view). All queries are read-only aggregates scoped to this dashboard; the
// booking lib does not expose these counts, so they live here.
import { getPool } from "../db/pool";
import { applyMarkup } from "../pricing";

/** node-postgres returns `date`/`timestamptz` columns as JS Date objects. */
function toDateString(value: string | Date): string {
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

export interface DashboardMetrics {
  activeRequests: number; // building + proposals_ready
  awaitingClient: number; // proposals_ready (waiting for the client to pick/pay)
  confirmedTrips: number; // paid orders
  marginThisMonth: number; // accumulated markup on this-month paid orders
}

/**
 * The four top-of-dashboard metric cards. Margin is derived from the real
 * order_items NET totals via applyMarkup (never a hardcoded 0.30), so the
 * figure stays consistent with the pricing constant.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const pool = getPool();

  const { rows: statusRows } = await pool.query(
    `SELECT status, count(*)::int AS n FROM client_requests GROUP BY status`
  );
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = r.n;

  const activeRequests = (byStatus["building"] ?? 0) + (byStatus["proposals_ready"] ?? 0);
  const awaitingClient = byStatus["proposals_ready"] ?? 0;

  const { rows: orderRows } = await pool.query(
    `SELECT count(*)::int AS n FROM orders`
  );
  const confirmedTrips = orderRows[0]?.n ?? 0;

  // Margin this month = accumulated markup on paid orders created this month.
  // Sum the NET (order_items) for those orders, then markup − net.
  const { rows: netRows } = await pool.query(
    `SELECT COALESCE(sum(oi.net_price), 0)::numeric AS net
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE oi.status <> 'disrupted'
       AND date_trunc('month', o.created_at) = date_trunc('month', now())`
  );
  const netThisMonth = Number(netRows[0]?.net ?? 0);
  const marginThisMonth = Math.round((applyMarkup(netThisMonth) - netThisMonth) * 100) / 100;

  return { activeRequests, awaitingClient, confirmedTrips, marginThisMonth };
}

export type RequestStatus = "building" | "proposals_ready" | "paid" | "expired";

export interface RecentRequestRow {
  id: string;
  email: string;
  arrival_date: string;
  departure_date: string;
  travelers: number;
  status: RequestStatus;
  /** Marked-up value: the paid client_price if paid, else the client's budget. */
  value: number;
  is_paid_value: boolean;
  created_at: string;
}

/** The recent-requests table: client, dates, value, status. */
export async function getRecentRequests(limit = 12): Promise<RecentRequestRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT cr.id, cr.email, cr.arrival_date, cr.departure_date, cr.travelers,
            cr.status, cr.budget_total, cr.created_at,
            o.client_price
     FROM client_requests cr
     LEFT JOIN LATERAL (
       SELECT client_price FROM orders o
       WHERE o.request_id = cr.id
       ORDER BY o.created_at DESC LIMIT 1
     ) o ON true
     ORDER BY cr.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r: any) => {
    const paid = r.client_price != null;
    return {
      id: r.id,
      email: r.email,
      arrival_date: toDateString(r.arrival_date),
      departure_date: toDateString(r.departure_date),
      travelers: Number(r.travelers),
      status: r.status,
      value: paid ? Number(r.client_price) : Number(r.budget_total),
      is_paid_value: paid,
      created_at:
        typeof r.created_at === "string" ? r.created_at : r.created_at.toISOString(),
    };
  });
}

export interface OrderRepairRow {
  id: string;
  email: string;
  client_price: number;
  created_at: string;
  disrupted_count: number;
  replaced_count: number;
  booked_experience_count: number;
}

/**
 * Paid orders for the repair demo panel (SBI-13): the trigger surface for
 * "simulate disruption" / "repair" actions. Read-only aggregate of
 * order_items status counts per order.
 */
export async function getOrdersForRepair(limit = 8): Promise<OrderRepairRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT o.id, cr.email, o.client_price, o.created_at,
            count(*) FILTER (WHERE oi.status = 'disrupted' AND oi.item_type = 'experience')::int AS disrupted_count,
            count(*) FILTER (WHERE oi.status = 'replaced' AND oi.item_type = 'experience')::int AS replaced_count,
            count(*) FILTER (WHERE oi.status = 'booked' AND oi.item_type = 'experience')::int AS booked_experience_count
     FROM orders o
     JOIN client_requests cr ON cr.id = o.request_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     GROUP BY o.id, cr.email, o.client_price, o.created_at
     ORDER BY o.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    client_price: Number(r.client_price),
    created_at: toDateString(r.created_at),
    disrupted_count: r.disrupted_count,
    replaced_count: r.replaced_count,
    booked_experience_count: r.booked_experience_count,
  }));
}

export interface ProviderResponsePanel {
  formal: { total: number; responding: number; pending: number };
  informal: { total: number; responding: number; pending: number };
}

/**
 * Provider response panel: formal (instant confirmation) vs informal
 * (on-request) responding/pending counts. Ties to providers.confirmation_mode
 * (the modeled formal/informal axis) and the provider_responses table.
 *
 * A formal/instant provider is always "responding" (they answer instantly by
 * definition). An informal/on-request provider counts as "responding" once it
 * has at least one recorded response in provider_responses; otherwise pending.
 */
export async function getProviderResponsePanel(): Promise<ProviderResponsePanel> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.provider_type,
            p.confirmation_mode,
            count(*)::int AS total,
            count(*) FILTER (WHERE pr.provider_id IS NOT NULL)::int AS responded
     FROM providers p
     LEFT JOIN (
       SELECT DISTINCT provider_id FROM provider_responses
     ) pr ON pr.provider_id = p.id
     GROUP BY p.provider_type, p.confirmation_mode`
  );

  const panel: ProviderResponsePanel = {
    formal: { total: 0, responding: 0, pending: 0 },
    informal: { total: 0, responding: 0, pending: 0 },
  };

  for (const r of rows) {
    const total = Number(r.total);
    const responded = Number(r.responded);
    const isFormal = r.confirmation_mode === "instant" || r.provider_type === "formal";
    const bucket = isFormal ? panel.formal : panel.informal;
    bucket.total += total;
    // Formal/instant providers respond by definition; informal only once they
    // have a recorded response.
    const responding = isFormal ? total : responded;
    bucket.responding += responding;
    bucket.pending += total - responding;
  }

  return panel;
}
