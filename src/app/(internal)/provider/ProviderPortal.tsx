import type { BookedService, HistoryItem, ProviderInbox } from "@/lib/provider";
import styles from "./provider.module.css";

/**
 * Bookings body: the acting provider's paid jobs and response history. There
 * is no accept/decline inbox — every availability request is resolved by the
 * simulated responder in the same pipeline run as the match, before a
 * provider could ever see it, so history is the only thing to show. The
 * "Viewing as" switcher lives in the sidebar, so no context bar here.
 */
export default function BookingsView({
  inbox,
  bookings,
}: {
  inbox: ProviderInbox;
  bookings: BookedService[];
}) {
  return (
    <>
      <BookedServices bookings={bookings} />
      <History history={inbox.history} />
    </>
  );
}

// ─── Booked services ──────────────────────────────────────────────────────────

function BookedServices({ bookings }: { bookings: BookedService[] }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Booked services</h2>
        <span className={styles.count}>{bookings.length}</span>
      </div>
      <p className={styles.sectionSub}>
        Trips a traveler already paid for, confirmed and yours to deliver, with the net rate
        you will be paid for each one.
      </p>

      {bookings.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No booked services yet</p>
          <p className={styles.emptySub}>
            Once a traveler pays for a trip that includes your service, it appears here as a job to
            deliver.
          </p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {bookings.map((b) => (
            <BookedCard key={b.orderItemId} booking={b} />
          ))}
        </div>
      )}
    </section>
  );
}

function BookedCard({ booking }: { booking: BookedService }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.ticket}>{booking.ticket}</span>
        <span className={styles.bookedTag}>Paid</span>
      </div>

      <dl className={styles.detailGrid}>
        <div className={styles.detail}>
          <dt>Date</dt>
          <dd>{formatDate(booking.date)}</dd>
        </div>
        <div className={styles.detail}>
          <dt>Time</dt>
          <dd>{formatTime(booking.time)}</dd>
        </div>
        <div className={styles.detail}>
          <dt>People</dt>
          <dd>
            {booking.travelers} {booking.travelers === 1 ? "person" : "people"}
          </dd>
        </div>
        <div className={`${styles.detail} ${styles.detailWide}`}>
          <dt>Service booked</dt>
          <dd>{booking.serviceName}</dd>
        </div>
      </dl>

      <div className={styles.payBlock}>
        <span className={styles.payLabel}>You&rsquo;ll be paid</span>
        <span className={styles.payAmount}>${booking.netRateTotal.toLocaleString()}</span>
      </div>
    </article>
  );
}

// ─── History ────────────────────────────────────────────────────────────────

function History({ history }: { history: HistoryItem[] }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Recent history</h2>
        <span className={styles.count}>{history.length}</span>
      </div>

      {history.length === 0 ? (
        <p className={styles.emptyNote}>No past responses yet.</p>
      ) : (
        <ul className={styles.historyList}>
          {history.map((h) => (
            <li key={`${h.requestId}|${h.experienceId}`} className={styles.historyRow}>
              <div className={styles.historyMain}>
                <span className={styles.historyService}>{h.serviceName}</span>
                <span className={styles.historyMeta}>
                  {h.ticket} · {formatDateTime(h.decidedAt)}
                </span>
              </div>
              <span className={styles.historyPay}>${h.netRateTotal.toLocaleString()}</span>
              <span
                className={`${styles.historyBadge} ${
                  h.decision === "confirmed" ? styles.badgeConfirmed : styles.badgeDeclined
                }`}
              >
                {h.decision === "confirmed" ? "Accepted" : "Declined"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}
