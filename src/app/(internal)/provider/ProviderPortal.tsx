"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter as useNavRouter } from "next/navigation";
import type { AvailabilityRequest, BookedService, HistoryItem, ProviderInbox } from "@/lib/provider";
import { respondToRequest, reportCannotDeliver } from "./actions";
import styles from "./provider.module.css";

/**
 * Bookings body: the acting provider's inbox, paid jobs, and response history.
 * The "Viewing as" switcher now lives in the sidebar, so no context bar here.
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
      <Inbox pending={inbox.pending} providerId={inbox.provider.id} />
      <BookedServices bookings={bookings} providerId={inbox.provider.id} />
      <History history={inbox.history} />
    </>
  );
}

// ─── Inbox ────────────────────────────────────────────────────────────────

function Inbox({ pending, providerId }: { pending: AvailabilityRequest[]; providerId: string }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Incoming requests</h2>
        <span className={styles.count}>{pending.length}</span>
      </div>
      <p className={styles.sectionSub}>
        Availability asks for trips still being planned, before the traveler pays. Accept the ones
        you can host or decline them.
      </p>

      {pending.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No open requests right now</p>
          <p className={styles.emptySub}>
            New availability requests from Rumbo will appear here as travelers plan trips that
            match your services.
          </p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {pending.map((req) => (
            <RequestCard key={`${req.requestId}|${req.experienceId}`} req={req} providerId={providerId} />
          ))}
        </div>
      )}
    </section>
  );
}

type LocalStatus = "open" | "confirmed" | "declined" | "error";

function RequestCard({ req, providerId }: { req: AvailabilityRequest; providerId: string }) {
  const router = useNavRouter();
  const [status, setStatus] = useState<LocalStatus>("open");
  const [isPending, startTransition] = useTransition();
  const remaining = useCountdown(req.windowExpiresAt);
  const expired = remaining <= 0;

  function respond(decision: "confirmed" | "declined") {
    setStatus(decision);
    startTransition(async () => {
      const res = await respondToRequest(providerId, req.requestId, req.experienceId, decision);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      // Sync server state (moves this card into history on refresh).
      router.refresh();
    });
  }

  const answered = status === "confirmed" || status === "declined";

  return (
    <article className={`${styles.card} ${answered ? styles.cardAnswered : ""}`}>
      <div className={styles.cardTop}>
        <span className={styles.ticket}>{req.ticket}</span>
        {expired && status === "open" ? (
          <span className={`${styles.window} ${styles.windowClosed}`}>Window elapsed</span>
        ) : status === "open" ? (
          <span className={`${styles.window} ${remaining < 60_000 ? styles.windowUrgent : ""}`}>
            <span className={styles.windowDot} aria-hidden />
            Respond within {formatCountdown(remaining)}
          </span>
        ) : null}
      </div>

      <dl className={styles.detailGrid}>
        <div className={styles.detail}>
          <dt>Date</dt>
          <dd>{formatDate(req.date)}</dd>
        </div>
        <div className={styles.detail}>
          <dt>Time</dt>
          <dd>{formatTime(req.time)}</dd>
        </div>
        <div className={styles.detail}>
          <dt>People</dt>
          <dd>
            {req.travelers} {req.travelers === 1 ? "person" : "people"}
          </dd>
        </div>
        <div className={`${styles.detail} ${styles.detailWide}`}>
          <dt>Service requested</dt>
          <dd>{req.serviceName}</dd>
        </div>
      </dl>

      <div className={styles.payBlock}>
        <span className={styles.payLabel}>You&rsquo;ll be paid</span>
        <span className={styles.payAmount}>${req.netRateTotal.toLocaleString()}</span>
        <span className={styles.paySub}>
          ${req.netRatePerPerson} × {req.travelers} {req.travelers === 1 ? "person" : "people"}
        </span>
      </div>

      {status === "open" && (
        <div className={styles.actions}>
          <button
            className={styles.confirmBtn}
            onClick={() => respond("confirmed")}
            disabled={isPending}
          >
            Yes, we have space
          </button>
          <button
            className={styles.declineBtn}
            onClick={() => respond("declined")}
            disabled={isPending}
          >
            Can&rsquo;t take it
          </button>
        </div>
      )}

      {status === "confirmed" && (
        <div className={`${styles.resultBanner} ${styles.resultConfirmed}`}>Confirmed ✓</div>
      )}
      {status === "declined" && (
        <div className={`${styles.resultBanner} ${styles.resultDeclined}`}>Declined</div>
      )}
      {status === "error" && (
        <div className={`${styles.resultBanner} ${styles.resultError}`}>
          Couldn&rsquo;t save — try again
        </div>
      )}
    </article>
  );
}

// ─── Booked services ──────────────────────────────────────────────────────────

function BookedServices({
  bookings,
  providerId,
}: {
  bookings: BookedService[];
  providerId: string;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Booked services</h2>
        <span className={styles.count}>{bookings.length}</span>
      </div>
      <p className={styles.sectionSub}>
        Trips a traveler already paid for, confirmed and yours to deliver. If you can no longer
        host one, use &ldquo;Can&rsquo;t deliver this&rdquo; and Rumbo re-books that day with
        another provider.
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
            <BookedCard key={b.orderItemId} booking={b} providerId={providerId} />
          ))}
        </div>
      )}
    </section>
  );
}

type DeliverState = "idle" | "confirming" | "repaired" | "failed" | "error";

function BookedCard({ booking, providerId }: { booking: BookedService; providerId: string }) {
  const router = useNavRouter();
  const [state, setState] = useState<DeliverState>("idle");
  const [reason, setReason] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function confirmDropout() {
    startTransition(async () => {
      const res = await reportCannotDeliver(providerId, booking.orderItemId, booking.orderId);
      if (!res.ok) {
        setState("error");
        return;
      }
      if (res.repaired) {
        setState("repaired");
        // Refresh so the now-replaced job drops off the list.
        router.refresh();
      } else {
        setReason(res.reason);
        setState("failed");
      }
    });
  }

  const done = state === "repaired";

  return (
    <article className={`${styles.card} ${done ? styles.cardAnswered : ""}`}>
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

      {state === "idle" && (
        <div className={styles.actions}>
          <button className={styles.declineBtn} onClick={() => setState("confirming")}>
            Can&rsquo;t deliver this
          </button>
        </div>
      )}

      {state === "confirming" && (
        <div className={styles.confirmBlock}>
          <p className={styles.confirmNote}>
            Rumbo will re-book this day with another provider and this job leaves your list. Continue?
          </p>
          <div className={styles.actions}>
            <button
              className={styles.declineBtn}
              onClick={confirmDropout}
              disabled={isPending}
            >
              {isPending ? "Re-booking…" : "Yes, I can't deliver"}
            </button>
            <button
              className={styles.keepBtn}
              onClick={() => setState("idle")}
              disabled={isPending}
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      {state === "repaired" && (
        <div className={`${styles.resultBanner} ${styles.resultConfirmed}`}>
          Re-booked with another provider ✓
        </div>
      )}
      {state === "failed" && (
        <div className={`${styles.resultBanner} ${styles.resultError}`}>
          Couldn&rsquo;t re-book: {reason}
        </div>
      )}
      {state === "error" && (
        <div className={`${styles.resultBanner} ${styles.resultError}`}>
          Something went wrong — try again
        </div>
      )}
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

function useCountdown(targetIso: string): number {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(targetIso).getTime() - Date.now())
  );
  useEffect(() => {
    const target = new Date(targetIso).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return remaining;
}

function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
