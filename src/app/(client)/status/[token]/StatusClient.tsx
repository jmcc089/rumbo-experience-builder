"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pollStatus } from "../../proposals/actions";
import type { RequestStatus } from "@/lib/types";
import styles from "./status.module.css";

type Status = RequestStatus | "not_found";

/** Statuses where the request is still being worked and the page should poll. */
const WAITING: Status[] = ["building", "awaiting_providers"];

/**
 * Status page. Calm "we're building" state that polls the request status
 * (simple interval polling — NO WebSockets/SSE, per SBI-00). The real
 * re-engagement is Email 2; this page just reflects DB state when open.
 */
export default function StatusClient({
  token,
  initialStatus,
}: {
  token: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);

  useEffect(() => {
    // Stop polling once there's nothing left to wait for.
    if (!WAITING.includes(status)) return;
    const id = setInterval(async () => {
      try {
        const res = await pollStatus(token);
        setStatus(res.status);
      } catch {
        /* transient — keep polling */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [status, token]);

  return (
    <main className={styles.main}>
      <section className={styles.panel}>
        {WAITING.includes(status) && (
          <>
            <div className={styles.mark} aria-hidden>
              <span className="rumbo-logo">
                Rumbo<span className="dot">.</span>
              </span>
              <span className={styles.pulse} />
            </div>
            <span className={styles.eyebrow}>Building your experience</span>
            <h1 className={styles.title}>We’re shaping your itineraries</h1>
            <p className={styles.body}>
              We’re contacting local providers to confirm availability and assembling three
              complete itineraries around what you told us. We’ll email you the moment they’re ready —
              usually within a few minutes. You can safely close this page.
            </p>
            <div className={styles.note}>No payment until you approve an itinerary.</div>
          </>
        )}

        {status === "proposals_ready" && (
          <>
            <span className={styles.eyebrow}>Ready</span>
            <h1 className={styles.title}>Your itineraries are ready</h1>
            <p className={styles.body}>
              Three complete trips are waiting for you. Opening them starts a 15-minute hold with our
              providers, so have a moment to choose.
            </p>
            <Link href={`/proposals/${token}`} className={styles.cta}>
              View my itineraries
            </Link>
          </>
        )}

        {status === "paid" && (
          <>
            <span className={styles.eyebrow}>Confirmed</span>
            <h1 className={styles.title}>Your trip is booked</h1>
            <p className={styles.body}>
              This request is confirmed and the details are in your inbox.
            </p>
            <Link href={`/proposals/${token}`} className={styles.cta}>
              View my booking
            </Link>
          </>
        )}

        {status === "expired" && (
          <>
            <span className={styles.eyebrow}>Hold released</span>
            <h1 className={styles.title}>These options have expired</h1>
            <p className={styles.body}>
              Held itineraries are reserved for 15 minutes. Starting again takes only a moment.
            </p>
            <Link href="/" className={styles.cta}>
              Start a new request
            </Link>
          </>
        )}

        {status === "no_availability" && (
          <>
            <span className={styles.eyebrow}>No availability</span>
            <h1 className={styles.title}>We couldn’t assemble a trip this time</h1>
            <p className={styles.body}>
              Not enough providers had availability for your dates to build complete itineraries.
              Trying different dates often helps.
            </p>
            <Link href="/" className={styles.cta}>
              Start a new request
            </Link>
          </>
        )}

        {status === "not_found" && (
          <>
            <span className={styles.eyebrow}>Not found</span>
            <h1 className={styles.title}>We couldn’t find this request</h1>
            <p className={styles.body}>
              This link may be incomplete or no longer valid. Check the link in your email, or start a new
              request.
            </p>
            <Link href="/" className={styles.cta}>
              Start a new request
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
