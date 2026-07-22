"use client";

import { useMemo, useState } from "react";
import type { ExperienceCategory, ClientPrefs, LodgingTier } from "@/lib/types";
import {
  MAX_TRIP_SPAN_DAYS,
  maxDepartureDate,
  tripSpanDays,
  tierForBudget,
  budgetPerDay,
  isBudgetLow,
} from "@/lib/config";
import { submitIntake, type IntakePayload } from "../actions";
import styles from "./IntakeForm.module.css";

/* ------------------------------------------------------------------ */
/* Option tables                                                       */
/* ------------------------------------------------------------------ */

// Five interest chips (SBI copy). "Nature & adventure" maps to two engine
// categories so both flow to the interest-match metric.
const INTEREST_OPTIONS: { id: string; label: string; cats: ExperienceCategory[] }[] = [
  { id: "nature_adventure", label: "Nature & adventure", cats: ["nature", "adventure"] },
  { id: "food", label: "Food & gastronomy", cats: ["food"] },
  { id: "culture", label: "Culture & history", cats: ["culture"] },
  { id: "beach", label: "Beach & relax", cats: ["beach"] },
  { id: "coffee", label: "Coffee & landscape", cats: ["coffee"] },
];

const PACE_OPTIONS: { value: NonNullable<ClientPrefs["pace"]>; label: string }[] = [
  { value: "relaxed", label: "Relaxed" },
  { value: "moderate", label: "Balanced" },
  { value: "packed", label: "Intense" },
];

const MORNING_OPTIONS: { value: NonNullable<ClientPrefs["mornings"]>; label: string }[] = [
  { value: "early_ok", label: "Fine to wake early for special activities" },
  { value: "no_early", label: "Prefer no early mornings" },
];

const GROUP_OPTIONS: { value: NonNullable<ClientPrefs["group_composition"]>; label: string }[] = [
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family with kids" },
  { value: "friends", label: "Friends" },
  { value: "solo", label: "Solo" },
];

// The client no longer picks a lodging level — the budget defines it. This
// copy explains the band a given budget-per-day unlocks (shown under the
// budget field), so the derivation is transparent.
const TIER_COPY: Record<LodgingTier, { label: string; desc: string }> = {
  budget: { label: "Budget", desc: "guesthouses & simple stays" },
  comfort: { label: "Comfort", desc: "mid-range hotels & boutique stays" },
  premium: { label: "Premium", desc: "upscale & premium lodging" },
};

const STEPS = ["The basics", "Preferences", "Your voice"];

// Flight times are approximate, so we offer a dropdown in fixed steps instead
// of free typing. Value stays "HH:MM" (24h) for the backend; label is 12h.
// Flip TIME_STEP_MIN to 15 for finer granularity.
const TIME_STEP_MIN = 30;
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let m = 0; m < 24 * 60; m += TIME_STEP_MIN) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const value = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    out.push({ value, label: `${h12}:${String(min).padStart(2, "0")} ${ampm}` });
  }
  return out;
})();

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface FormState {
  arrival_date: string;
  departure_date: string;
  arrival_time: string;
  departure_time: string;
  travelers: string;
  budget_total: string;
  interests: string[]; // chip ids
  pace: NonNullable<ClientPrefs["pace"]> | "";
  mornings: NonNullable<ClientPrefs["mornings"]> | "";
  group_composition: NonNullable<ClientPrefs["group_composition"]> | "";
  free_text: string;
  name: string;
  email: string;
}

const EMPTY: FormState = {
  arrival_date: "",
  departure_date: "",
  arrival_time: "",
  departure_time: "",
  travelers: "2",
  budget_total: "",
  interests: [],
  pace: "",
  mornings: "",
  group_composition: "",
  free_text: "",
  name: "",
  email: "",
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const today = () => new Date().toISOString().slice(0, 10);

export default function IntakeForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleInterest = (id: string) =>
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(id)
        ? f.interests.filter((x) => x !== id)
        : [...f.interests, id],
    }));

  const tripTooLong = useMemo(
    () =>
      !!form.arrival_date &&
      !!form.departure_date &&
      form.departure_date >= form.arrival_date &&
      tripSpanDays(form.arrival_date, form.departure_date) > MAX_TRIP_SPAN_DAYS,
    [form.arrival_date, form.departure_date]
  );

  const step1Valid = useMemo(
    () =>
      !!form.arrival_date &&
      !!form.departure_date &&
      form.departure_date >= form.arrival_date &&
      tripSpanDays(form.arrival_date, form.departure_date) <= MAX_TRIP_SPAN_DAYS &&
      !!form.arrival_time &&
      !!form.departure_time &&
      Number(form.travelers) >= 1 &&
      Number(form.budget_total) > 0,
    [form]
  );

  // Budget → lodging band, computed live for the hint under the budget field.
  // Needs valid dates + a positive budget; otherwise nothing is shown.
  const budgetRange = useMemo(() => {
    const budget = Number(form.budget_total);
    const travelers = Number(form.travelers);
    if (
      !form.arrival_date ||
      !form.departure_date ||
      form.departure_date < form.arrival_date ||
      !(budget > 0) ||
      !(travelers >= 1)
    ) {
      return null;
    }
    const span = tripSpanDays(form.arrival_date, form.departure_date);
    if (span > MAX_TRIP_SPAN_DAYS) return null;
    return {
      span,
      perDay: budgetPerDay(span, budget),
      tier: tierForBudget(span, budget, travelers),
      low: isBudgetLow(span, budget, travelers),
    };
  }, [form.arrival_date, form.departure_date, form.budget_total, form.travelers]);

  const step2Valid = useMemo(
    () =>
      form.interests.length > 0 &&
      !!form.pace &&
      !!form.mornings &&
      !!form.group_composition,
    [form]
  );

  const step3Valid = form.name.trim().length > 0 && isEmail(form.email);

  async function handleSubmit() {
    setError(null);
    if (!step1Valid || !step2Valid || !step3Valid) {
      setError("Please complete every step before submitting.");
      return;
    }
    setSubmitting(true);

    const cats = Array.from(
      new Set(
        form.interests.flatMap(
          (id) => INTEREST_OPTIONS.find((o) => o.id === id)?.cats ?? []
        )
      )
    );

    const payload: IntakePayload = {
      name: form.name.trim(),
      email: form.email.trim(),
      arrival_date: form.arrival_date,
      departure_date: form.departure_date,
      arrival_time: form.arrival_time,
      departure_time: form.departure_time,
      travelers: Number(form.travelers),
      budget_total: Number(form.budget_total),
      interests: cats,
      pace: form.pace || undefined,
      mornings: form.mornings || undefined,
      group_composition: form.group_composition || undefined,
      // Derived from the budget (the server re-derives authoritatively).
      lodging_tier: tierForBudget(
        tripSpanDays(form.arrival_date, form.departure_date),
        Number(form.budget_total),
        Number(form.travelers)
      ),
      free_text: form.free_text,
    };

    try {
      const res = await submitIntake(payload);
      if (res.ok) {
        setToken(res.token);
        setDone(true);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return <BuildingState email={form.email.trim()} token={token} />;
  }

  return (
    <div className={styles.card}>
      <Progress step={step} />

      <div className={styles.body}>
        {step === 1 && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.stepTitle}>The basics</legend>
            <p className={styles.stepHint}>
              The fixed points of your trip: dates, flights, party size and budget.
            </p>

            <div className={styles.grid2}>
              <Field label="Arrival date">
                <input
                  type="date"
                  className={`${styles.input} ${form.arrival_date ? "" : styles.inputEmpty}`}
                  min={today()}
                  value={form.arrival_date}
                  onChange={(e) => set("arrival_date", e.target.value)}
                />
              </Field>
              <Field label="Departure date">
                <input
                  type="date"
                  className={`${styles.input} ${form.departure_date ? "" : styles.inputEmpty}`}
                  min={form.arrival_date || today()}
                  max={form.arrival_date ? maxDepartureDate(form.arrival_date) : undefined}
                  value={form.departure_date}
                  onChange={(e) => set("departure_date", e.target.value)}
                />
              </Field>
              <Field label="Arrival flight time (approx.)">
                <select
                  className={`${styles.input} ${styles.select} ${form.arrival_time ? "" : styles.inputEmpty}`}
                  value={form.arrival_time}
                  onChange={(e) => set("arrival_time", e.target.value)}
                >
                  <option value="" disabled>
                    Select a time
                  </option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Departure flight time (approx.)">
                <select
                  className={`${styles.input} ${styles.select} ${form.departure_time ? "" : styles.inputEmpty}`}
                  value={form.departure_time}
                  onChange={(e) => set("departure_time", e.target.value)}
                >
                  <option value="" disabled>
                    Select a time
                  </option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Travelers">
                <input
                  type="number"
                  min={1}
                  className={styles.input}
                  value={form.travelers}
                  onChange={(e) => set("travelers", e.target.value)}
                />
              </Field>
              <Field label="Total budget (USD)">
                <div className={styles.moneyWrap}>
                  <span className={styles.moneyPrefix}>$</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    placeholder="4,000"
                    className={`${styles.input} ${styles.moneyInput}`}
                    value={form.budget_total}
                    onChange={(e) => set("budget_total", e.target.value)}
                  />
                </div>
              </Field>
            </div>
            {budgetRange && (
              <p
                className={`${styles.rangeHint} ${
                  budgetRange.low ? styles.rangeHintLow : ""
                }`}
              >
                {budgetRange.low ? (
                  <>
                    About ${Math.round(budgetRange.perDay).toLocaleString()}/day,
                    a little low for a {budgetRange.span + 1}-day trip. We’ll
                    try, but options may be limited.
                  </>
                ) : (
                  <>
                    About ${Math.round(budgetRange.perDay).toLocaleString()}/day,
                    so we’ll aim for{" "}
                    <strong>{TIER_COPY[budgetRange.tier].label}</strong> stays (
                    {TIER_COPY[budgetRange.tier].desc}).
                  </>
                )}
              </p>
            )}
            {form.arrival_date &&
              form.departure_date &&
              form.departure_date < form.arrival_date && (
                <p className={styles.inlineError}>
                  Departure can’t be before arrival.
                </p>
              )}
            {tripTooLong && (
              <p className={styles.inlineError}>
                We currently build trips of up to {MAX_TRIP_SPAN_DAYS + 1} days.
                Please choose a departure within {MAX_TRIP_SPAN_DAYS} days of your
                arrival.
              </p>
            )}
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.stepTitle}>Preferences</legend>
            <p className={styles.stepHint}>
              These shape how we weight and pace every itinerary.
            </p>

            <div className={styles.block}>
              <span className={styles.blockLabel}>
                Interests <span className={styles.subtle}>· choose one or more</span>
              </span>
              <div className={styles.chips}>
                {INTEREST_OPTIONS.map((o) => {
                  const on = form.interests.includes(o.id);
                  return (
                    <button
                      type="button"
                      key={o.id}
                      className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                      aria-pressed={on}
                      onClick={() => toggleInterest(o.id)}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.block}>
              <span className={styles.blockLabel}>Pace</span>
              <Segmented
                options={PACE_OPTIONS}
                value={form.pace}
                onChange={(v) => set("pace", v)}
              />
            </div>

            <div className={styles.block}>
              <span className={styles.blockLabel}>Mornings</span>
              <div className={styles.stack}>
                {MORNING_OPTIONS.map((o) => {
                  const on = form.mornings === o.value;
                  return (
                    <button
                      type="button"
                      key={o.value}
                      className={`${styles.option} ${on ? styles.optionOn : ""}`}
                      aria-pressed={on}
                      onClick={() => set("mornings", o.value)}
                    >
                      <span className={styles.radioDot} aria-hidden />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.block}>
              <span className={styles.blockLabel}>Group</span>
              <Segmented
                options={GROUP_OPTIONS}
                value={form.group_composition}
                onChange={(v) => set("group_composition", v)}
                wrap
              />
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.stepTitle}>Your voice</legend>
            <p className={styles.stepHint}>
              Tell us what matters to you. Whether it’s a special occasion, a
              passion, a dietary preference, or something you’d rather avoid. We’d
              love to shape every detail around you.
            </p>

            <div className={styles.block}>
              <textarea
                className={styles.textarea}
                rows={5}
                placeholder="We’re celebrating our anniversary, we love specialty coffee, my wife is vegetarian, and we’d rather skip the very touristy spots."
                value={form.free_text}
                onChange={(e) => set("free_text", e.target.value)}
              />
            </div>

            <div className={styles.grid2}>
              <Field label="Your name">
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Jordan Rivera"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field label="Email for your itineraries">
                <input
                  type="email"
                  className={styles.input}
                  placeholder="you@email.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
            </div>
            <p className={styles.subtle}>
              No account, no password. Your itineraries arrive by email.
            </p>
          </fieldset>
        )}

        {error && <p className={styles.formError}>{error}</p>}
      </div>

      <div className={styles.footer}>
        {step > 1 ? (
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setStep((s) => s - 1)}
            disabled={submitting}
          >
            Back
          </button>
        ) : (
          <span />
        )}

        {step < 3 ? (
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={step === 1 ? !step1Valid : !step2Valid}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={!step3Valid || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Sending…" : "Build my experience"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Progress({ step }: { step: number }) {
  return (
    <ol className={styles.progress} aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "active" : "todo";
        return (
          <li key={label} className={`${styles.pItem} ${styles[`p_${state}`]}`}>
            <span className={styles.pDot}>{n < step ? "✓" : n}</span>
            <span className={styles.pLabel}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  wrap,
}: {
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
  wrap?: boolean;
}) {
  return (
    <div className={`${styles.segmented} ${wrap ? styles.segmentedWrap : ""}`} role="group">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            type="button"
            key={o.value}
            className={`${styles.seg} ${on ? styles.segOn : ""}`}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function BuildingState({ email, token }: { email: string; token: string | null }) {
  return (
    <div className={styles.card}>
      <div className={styles.building}>
        <div className={styles.buildingMark} aria-hidden>
          <span className="rumbo-logo">
            Rumbo<span className="dot">.</span>
          </span>
        </div>
        <h2 className={styles.buildingTitle}>We’re building your experience</h2>
        <p className={styles.buildingBody}>
          Our coordinators are checking availability with local providers and
          shaping three complete itineraries around what you told us.
        </p>
        <p className={styles.buildingBody}>
          We’ll email <strong>{email}</strong> the moment your itineraries are
          ready, usually within a few minutes. You can close this page.
        </p>
        {token && (
          <a className={styles.buildingLink} href={`/status/${token}`}>
            Follow your request status
          </a>
        )}
        <div className={styles.buildingNote}>
          No payment until you approve an itinerary.
        </div>
      </div>
    </div>
  );
}
