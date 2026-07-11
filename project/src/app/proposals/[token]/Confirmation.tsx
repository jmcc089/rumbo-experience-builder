"use client";

import Link from "next/link";
import type { EnrichedProposal } from "@/lib/booking";
import { CategoryTags, ItineraryTimeline } from "./Itinerary";
import styles from "./proposals.module.css";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Booking-confirmed state. Shown after a successful simulated payment and when
 * reloading a proposals link whose request is already paid. Confident and
 * real-looking, with a small, discreet demo disclaimer — never a "this doesn't
 * work" button.
 */
export default function Confirmation({
  proposal,
  travelers,
  alreadyBooked = false,
}: {
  proposal: EnrichedProposal;
  travelers: number;
  alreadyBooked?: boolean;
}) {
  return (
    <section className={styles.confirm}>
      <div className={styles.confirmHead}>
        <span className={styles.confirmCheck} aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>
        <span className={styles.confirmEyebrow}>{alreadyBooked ? "Confirmed" : "Booking confirmed"}</span>
        <h1 className={styles.confirmTitle}>{proposal.title}</h1>
        <p className={styles.confirmLead}>
          {alreadyBooked
            ? "This trip is booked and confirmed. Your itinerary and receipt are in your inbox."
            : "You’re all set. A confirmation with every detail of your itinerary is on its way to your inbox."}
        </p>
      </div>

      <div className={styles.confirmSummary}>
        <div className={styles.confirmRow}>
          <span>Itinerary</span>
          <strong>{proposal.summary}</strong>
        </div>
        <div className={styles.confirmRow}>
          <span>Travelers</span>
          <strong>{travelers}</strong>
        </div>
        <div className={styles.confirmRow}>
          <span>Total paid</span>
          <strong className={styles.confirmTotal}>{money(proposal.client_total)}</strong>
        </div>
        <p className={styles.confirmAllin}>All in · nothing else to pay.</p>
      </div>

      <div className={styles.confirmItinerary}>
        <div className={styles.detailHead}>
          <h2 className={styles.detailTitle}>Your itinerary</h2>
          <CategoryTags categories={proposal.categories} />
        </div>
        <ItineraryTimeline days={proposal.days} />
      </div>

      <div className={styles.confirmFooter}>
        <p className={styles.demoNote}>
          This is a demonstration of Rumbo’s coordination system. Payment is simulated — no card details
          are collected and no charge is made.
        </p>
        <Link href="/" className={styles.confirmHome}>
          Back to Rumbo
        </Link>
      </div>
    </section>
  );
}
