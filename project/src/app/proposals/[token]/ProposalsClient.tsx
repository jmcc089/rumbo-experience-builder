"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/app/components/Header";
import type { EnrichedProposal } from "@/lib/booking";
import { bookTrip } from "../actions";
import { CategoryTags, ItineraryTimeline } from "./Itinerary";
import Confirmation from "./Confirmation";
import styles from "./proposals.module.css";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/* ── Hold countdown ─────────────────────────────────────────────────────── */

function useCountdown(expiresAt: string | null): { mmss: string; expired: boolean; urgent: boolean } {
  const target = useMemo(() => (expiresAt ? new Date(expiresAt).getTime() : null), [expiresAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target) return { mmss: "", expired: false, urgent: false };
  const remaining = Math.max(0, target - now);
  const totalSec = Math.floor(remaining / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return { mmss: `${mm}:${ss}`, expired: remaining <= 0, urgent: remaining > 0 && remaining <= 120_000 };
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function ProposalsClient({
  token,
  proposals,
  expiresAt,
  travelers,
}: {
  token: string;
  proposals: EnrichedProposal[];
  expiresAt: string | null;
  travelers: number;
}) {
  const [selected, setSelected] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const { mmss, expired, urgent } = useCountdown(expiresAt);

  const active = proposals[selected];

  async function handleBook() {
    setError(null);
    setPaying(true);
    try {
      const res = await bookTrip(token, selected);
      if (res.status === "paid") {
        setBooked(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (res.status === "expired") {
        setError("This hold has expired. Please start a new request to see fresh options.");
      } else {
        setError("We couldn’t complete your booking. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  if (booked) {
    return (
      <>
        <Header />
        <main className={styles.stateMain}>
          <Confirmation proposal={active} travelers={travelers} />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        {/* Intro + hold */}
        <section className={styles.intro}>
          <div className={styles.introText}>
            <span className={styles.eyebrow}>Your itineraries are ready</span>
            <h1 className={styles.h1}>Three ways to see El Salvador</h1>
            <p className={styles.lede}>
              Each one is complete and ready to book — activities, transfers, meals and where you sleep,
              every day. Compare them, then choose the trip that feels most like yours.
            </p>
          </div>
          <HoldBadge mmss={mmss} expired={expired} urgent={urgent} />
        </section>

        {/* Option cards */}
        <section className={styles.cards} aria-label="Itinerary options">
          {proposals.map((p, i) => (
            <OptionCard
              key={p.index}
              proposal={p}
              selected={i === selected}
              recommended={i === 0}
              onSelect={() => setSelected(i)}
            />
          ))}
        </section>

        {/* Selected detail + booking */}
        <section className={styles.detail}>
          <div className={styles.detailMain}>
            <div className={styles.detailHead}>
              <div>
                <span className={styles.detailEyebrow}>Selected itinerary</span>
                <h2 className={styles.detailTitle}>{active.title}</h2>
                <p className={styles.detailSummary}>{active.summary}</p>
              </div>
              <CategoryTags categories={active.categories} />
            </div>
            <ItineraryTimeline days={active.days} />
          </div>

          <aside className={styles.book}>
            <div className={styles.bookInner}>
              <span className={styles.bookLabel}>{active.title}</span>
              <div className={styles.bookPriceRow}>
                <span className={styles.bookPrice}>{money(active.client_total)}</span>
                <span className={styles.bookPer}>total · {travelers} {travelers === 1 ? "traveler" : "travelers"}</span>
              </div>
              <p className={styles.bookAllin}>All in · nothing else to pay.</p>

              <ul className={styles.included}>
                <li>{active.nights} {active.nights === 1 ? "night" : "nights"} of lodging</li>
                <li>All activities &amp; local transfers</li>
                <li>Daily meals as scheduled</li>
                <li>Coordination &amp; on-trip support</li>
              </ul>

              <button
                type="button"
                className={styles.bookBtn}
                onClick={handleBook}
                disabled={paying || expired}
              >
                {paying ? "Confirming…" : expired ? "Hold expired" : "Book this trip"}
              </button>

              {expired ? (
                <p className={styles.bookExpired}>
                  This hold has passed. <a href="/">Start a new request</a> for fresh options.
                </p>
              ) : (
                <p className={styles.bookReassure}>
                  {mmss ? `Held for you · ${mmss} left to choose. ` : ""}No payment details needed to confirm.
                </p>
              )}
              {error && <p className={styles.bookError}>{error}</p>}
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function HoldBadge({ mmss, expired, urgent }: { mmss: string; expired: boolean; urgent: boolean }) {
  if (!mmss) return null;
  return (
    <div className={`${styles.hold} ${expired ? styles.holdExpired : ""} ${urgent ? styles.holdUrgent : ""}`}>
      <span className={styles.holdIcon} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9 2h6" />
        </svg>
      </span>
      {expired ? (
        <span className={styles.holdText}>Hold released</span>
      ) : (
        <span className={styles.holdText}>
          Held for you · <strong>{mmss}</strong> left to choose
        </span>
      )}
    </div>
  );
}

function OptionCard({
  proposal,
  selected,
  recommended,
  onSelect,
}: {
  proposal: EnrichedProposal;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.card} ${selected ? styles.cardOn : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className={styles.cardTop}>
        <span className={styles.cardBadges}>
          {recommended && <span className={styles.recommend}>Recommended</span>}
          {selected && <span className={styles.selectedBadge}>Selected</span>}
        </span>
      </div>
      <h3 className={styles.cardTitle}>{proposal.title}</h3>
      <p className={styles.cardSummary}>{proposal.summary}</p>
      <CategoryTags categories={proposal.categories} />
      <div className={styles.cardFoot}>
        <span className={styles.cardPrice}>{money(proposal.client_total)}</span>
        <span className={styles.cardPer}>all in</span>
      </div>
    </button>
  );
}
