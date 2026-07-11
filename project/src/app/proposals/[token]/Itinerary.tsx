"use client";

import { useState } from "react";
import type { ExperienceCategory } from "@/lib/types";
import type { EnrichedDay } from "@/lib/booking";
import styles from "./proposals.module.css";

/* ── Formatting helpers ─────────────────────────────────────────────────── */

const CATEGORY_LABEL: Record<ExperienceCategory, string> = {
  nature: "Nature",
  adventure: "Adventure",
  beach: "Beach",
  culture: "Culture",
  coffee: "Coffee",
  food: "Food",
};

// Muted, cool-leaning accents — used only as small dots beside a tag.
const CATEGORY_COLOR: Record<ExperienceCategory, string> = {
  nature: "#3f7d5a",
  adventure: "#b06a3f",
  beach: "#2f8fb0",
  culture: "#5b6bb0",
  coffee: "#8a5a2b",
  food: "#b0553f",
};

const DEPENDENCY_NOTE: Record<string, string> = {
  sunrise_only: "Sunrise timing",
  tide_dependent: "Tide-dependent",
  weather_sensitive: "Weather-permitting",
};

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatMinutes(min: number): string {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/* ── Small inline icons (monoline, currentColor) ────────────────────────── */

function Icon({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {children}
    </svg>
  );
}

function CategoryGlyph({ category }: { category: ExperienceCategory }) {
  switch (category) {
    case "nature":
      return <Icon><path d="M3 20 9 8l4 7 3-4 5 9z" /></Icon>;
    case "adventure":
      return <Icon><circle cx="12" cy="12" r="9" /><path d="m15 9-4 1.5L9.5 15l4-1.5z" /></Icon>;
    case "beach":
      return <Icon><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></Icon>;
    case "culture":
      return <Icon><path d="M4 20h16M5 20V9m14 11V9M4 9h16L12 3z" /></Icon>;
    case "coffee":
      return <Icon><path d="M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 5h-2M8 5V3m3 2V3" /></Icon>;
    case "food":
      return <Icon><path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M18 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9" /></Icon>;
    default:
      return <Icon><circle cx="12" cy="12" r="8" /></Icon>;
  }
}

function TransferGlyph() {
  return (
    <Icon>
      <path d="M4 12h14m0 0-4-4m4 4-4 4" />
    </Icon>
  );
}

function MoonGlyph() {
  return (
    <Icon>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
    </Icon>
  );
}

/* ── Category tag ───────────────────────────────────────────────────────── */

export function CategoryTags({ categories }: { categories: ExperienceCategory[] }) {
  return (
    <div className={styles.tags}>
      {categories.map((c) => (
        <span key={c} className={styles.tag}>
          <span className={styles.tagDot} style={{ background: CATEGORY_COLOR[c] }} aria-hidden />
          {CATEGORY_LABEL[c]}
        </span>
      ))}
    </div>
  );
}

/* ── Timeline ───────────────────────────────────────────────────────────── */

function DayCard({ day }: { day: EnrichedDay }) {
  return (
    <li className={styles.day}>
      <div className={styles.dayRail} aria-hidden>
        <span className={styles.dayMarker}>{day.day_index}</span>
      </div>
      <div className={styles.dayBody}>
        <header className={styles.dayHead}>
          <div>
            <span className={styles.dayLabel}>Day {day.day_index}</span>
            <span className={styles.dayDate}>{formatDate(day.date)}</span>
          </div>
          <span className={styles.dayZone}>{day.zone_name}</span>
        </header>

        {day.transfer_in_minutes > 0 && (
          <div className={`${styles.event} ${styles.eventTransfer}`}>
            <span className={styles.eventIcon}>
              <TransferGlyph />
            </span>
            <span className={styles.eventText}>
              Transfer to {day.zone_name} · {formatMinutes(day.transfer_in_minutes)}
            </span>
          </div>
        )}

        {day.experiences.map((exp, i) => (
          <div className={styles.event} key={`${exp.name}-${i}`}>
            <span className={styles.eventIcon} style={{ color: CATEGORY_COLOR[exp.category] }}>
              <CategoryGlyph category={exp.category} />
            </span>
            <div className={styles.eventMain}>
              <span className={styles.eventText}>{exp.name}</span>
              <span className={styles.eventMeta}>
                {exp.start_time}–{exp.end_time}
                {exp.dependency ? <em className={styles.eventNote}> · {DEPENDENCY_NOTE[exp.dependency]}</em> : null}
              </span>
            </div>
          </div>
        ))}

        <div className={`${styles.event} ${styles.eventLodging}`}>
          <span className={styles.eventIcon}>
            <MoonGlyph />
          </span>
          <span className={styles.eventText}>
            Overnight · {day.lodging_name}
            <span className={styles.tierBadge}>{day.lodging_tier}</span>
          </span>
        </div>
      </div>
    </li>
  );
}

export function ItineraryTimeline({ days }: { days: EnrichedDay[] }) {
  const collapsible = days.length > 6;
  const [expanded, setExpanded] = useState(false);

  if (!collapsible || expanded) {
    return (
      <ol className={styles.timeline}>
        {days.map((day) => (
          <DayCard key={day.day_index} day={day} />
        ))}
      </ol>
    );
  }

  // Long trip, collapsed: first 2 days, a middle summary, last 2 days.
  const head = days.slice(0, 2);
  const middle = days.slice(2, days.length - 2);
  const tail = days.slice(days.length - 2);

  return (
    <ol className={styles.timeline}>
      {head.map((day) => (
        <DayCard key={day.day_index} day={day} />
      ))}
      <li className={styles.collapse}>
        <button type="button" className={styles.collapseBtn} onClick={() => setExpanded(true)}>
          Days {middle[0].day_index}–{middle[middle.length - 1].day_index} · show {middle.length} more{" "}
          {middle.length === 1 ? "day" : "days"}
        </button>
      </li>
      {tail.map((day) => (
        <DayCard key={day.day_index} day={day} />
      ))}
    </ol>
  );
}
