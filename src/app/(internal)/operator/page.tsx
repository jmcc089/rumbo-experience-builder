import {
  getDashboardMetrics,
  getRecentRequests,
  getProviderResponsePanel,
  type RequestStatus,
} from "@/lib/operator";
import styles from "./operator.module.css";

export const dynamic = "force-dynamic";

/**
 * Operator dashboard (SBI-12). Rumbo's OWN internal view of the business:
 * metric cards, a recent-requests table, and a provider-response panel.
 * Read-only. Margin/markup figures ARE shown here — this is the operator's own
 * surface, separate from the client and provider routes.
 */
export default async function OperatorPage() {
  const [metrics, requests, providerPanel] = await Promise.all([
    getDashboardMetrics(),
    getRecentRequests(),
    getProviderResponsePanel(),
  ]);

  const usd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const cards = [
    { label: "Active requests", value: String(metrics.activeRequests), hint: "Building + awaiting selection" },
    { label: "Awaiting client", value: String(metrics.awaitingClient), hint: "Proposals sent, not yet paid" },
    { label: "Confirmed trips", value: String(metrics.confirmedTrips), hint: "Paid orders, all time" },
    { label: "Margin this month", value: usd(metrics.marginThisMonth), hint: `Accumulated markup · ${monthLabel}`, accent: true },
  ];

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Operations overview</h1>
        <p className={styles.pageSub}>
          Live view of requests, confirmed trips, and provider coordination.
        </p>
      </div>

      {/* Metric cards */}
      <section className={styles.metricGrid} aria-label="Key metrics">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`${styles.metricCard} ${c.accent ? styles.metricAccent : ""}`}
          >
            <span className={styles.metricLabel}>{c.label}</span>
            <span className={styles.metricValue}>{c.value}</span>
            <span className={styles.metricHint}>{c.hint}</span>
          </div>
        ))}
      </section>

      {/* Provider response panel */}
      <section className={`${styles.section} ${styles.sectionStacked}`}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Provider responses</h2>
        </div>
        <div className={styles.panel}>
          <div className={styles.panelRows}>
            <ProviderRow
              label="Formal"
              sub="Instant confirmation"
              data={providerPanel.formal}
            />
            <ProviderRow
              label="Informal"
              sub="On request"
              data={providerPanel.informal}
            />
          </div>
          <p className={styles.panelNote}>
            Formal partners confirm instantly; informal partners are awaiting a
            response until they reply through their portal.
          </p>
        </div>
      </section>

      {/* Recent requests table */}
      <section className={`${styles.section} ${styles.sectionStacked}`}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Recent requests</h2>
          <span className={styles.count}>{requests.length}</span>
        </div>

        {requests.length === 0 ? (
          <div className={styles.emptyCard}>
            <p className={styles.emptyTitle}>No requests yet</p>
            <p className={styles.emptySub}>Incoming client requests will appear here.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Dates</th>
                  <th className={styles.numCol}>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className={styles.client}>{r.name || r.email}</span>
                      <span className={styles.travelers}>
                        {r.name ? `${r.email} · ` : ""}
                        {r.travelers} {r.travelers === 1 ? "traveler" : "travelers"}
                      </span>
                    </td>
                    <td className={styles.dates}>
                      {formatRange(r.arrival_date, r.departure_date)}
                    </td>
                    <td className={styles.numCol}>
                      <span className={styles.value}>{usd(r.value)}</span>
                      <span className={styles.valueTag}>
                        {r.is_paid_value ? "paid" : "budget"}
                      </span>
                    </td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  building: "Building",
  awaiting_providers: "Awaiting providers",
  proposals_ready: "Proposals sent",
  no_availability: "No availability",
  paid: "Paid",
  expired: "Expired",
};

function StatusPill({ status }: { status: RequestStatus }) {
  const cls =
    status === "paid"
      ? styles.pillPaid
      : status === "proposals_ready"
      ? styles.pillSent
      : status === "expired" || status === "no_availability"
      ? styles.pillExpired
      : styles.pillBuilding;
  return <span className={`${styles.pill} ${cls}`}>{STATUS_LABEL[status] ?? status}</span>;
}

function ProviderRow({
  label,
  sub,
  data,
}: {
  label: string;
  sub: string;
  data: { total: number; responding: number; pending: number };
}) {
  const pct = data.total > 0 ? Math.round((data.responding / data.total) * 100) : 0;
  return (
    <div className={styles.provRow}>
      <div className={styles.provHead}>
        <div>
          <span className={styles.provLabel}>{label}</span>
          <span className={styles.provSub}>{sub}</span>
        </div>
        <span className={styles.provCount}>
          <strong>{data.responding}</strong> / {data.total} responding
        </span>
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.provFoot}>
        <span>{data.responding} responding</span>
        <span>{data.pending} pending</span>
      </div>
    </div>
  );
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString("en-US", opts);
  const e = new Date(`${end}T00:00:00`).toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}
