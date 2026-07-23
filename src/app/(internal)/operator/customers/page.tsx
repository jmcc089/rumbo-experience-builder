import { getCustomers, type RequestStatus } from "@/lib/operator";
import styles from "../operator.module.css";

export const dynamic = "force-dynamic";

/**
 * Customers section: every client request with its trip data. Read-only.
 * One row per customer, newest first.
 */
export default async function CustomersPage() {
  const customers = await getCustomers();

  const usd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Customers</h1>
        <p className={styles.pageSub}>
          Everyone who has requested a trip, with their preferences and status.
        </p>
      </div>

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>All customers</h2>
        <span className={styles.count}>{customers.length}</span>
      </div>

      {customers.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No customers yet</p>
          <p className={styles.emptySub}>Client requests will appear here as they come in.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Trip</th>
                <th>Preferences</th>
                <th className={styles.numCol}>Budget</th>
                <th className={styles.numCol}>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className={styles.client}>{c.name || "—"}</span>
                    <span className={styles.travelers}>{c.email}</span>
                  </td>
                  <td className={styles.dates}>
                    {formatRange(c.arrival_date, c.departure_date)}
                    <span className={styles.travelers}>
                      {c.travelers} {c.travelers === 1 ? "traveler" : "travelers"}
                      {c.group_composition ? ` · ${cap(c.group_composition)}` : ""}
                    </span>
                  </td>
                  <td>
                    {c.interests.length > 0 ? (
                      <span className={styles.tags}>
                        {c.interests.map((i) => (
                          <span key={i} className={styles.tag}>
                            {cap(i)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className={styles.travelers}>—</span>
                    )}
                    {c.pace && <span className={styles.travelers}>{cap(c.pace)} pace</span>}
                  </td>
                  <td className={styles.numCol}>
                    <span className={styles.value}>{usd(c.budget_total)}</span>
                  </td>
                  <td className={styles.numCol}>
                    {c.paid_total != null ? (
                      <span className={styles.value}>{usd(c.paid_total)}</span>
                    ) : (
                      <span className={styles.travelers}>—</span>
                    )}
                  </td>
                  <td>
                    <StatusPill status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString("en-US", opts);
  const e = new Date(`${end}T00:00:00`).toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}
