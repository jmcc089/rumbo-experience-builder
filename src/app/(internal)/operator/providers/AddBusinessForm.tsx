"use client";
// Add-business form for the Providers section. Two shapes behind one type
// toggle: an experience business (writes providers + experiences) or a lodging.
// Controlled by state; builds FormData on submit and calls the server action.
import { useState, useTransition } from "react";
import {
  EXPERIENCE_CATEGORIES,
  DEPENDENCIES,
  LODGING_TIERS,
  PROVIDER_TYPES,
  CONFIRMATION_MODES,
  DAYS,
  type ZoneOption,
} from "@/lib/operator/catalog-fields";
import { createBusiness } from "./actions";
import styles from "../operator.module.css";

type Kind = "experience" | "lodging";

const DAY_LABEL: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AddBusinessForm({ zones }: { zones: ZoneOption[] }) {
  const [kind, setKind] = useState<Kind>("experience");
  const [days, setDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function toggleDay(d: string) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("kind", kind);
    if (kind === "experience") {
      fd.delete("open_days");
      for (const d of days) fd.append("open_days", d);
    }
    startTransition(async () => {
      const result = await createBusiness(fd);
      setMsg({ ok: result.ok, text: result.message });
      if (result.ok) {
        form.reset();
        setDays(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
      }
    });
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {/* Business type toggle */}
      <div className={styles.field}>
        <span className={styles.label}>Business type</span>
        <div className={styles.segmented} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={kind === "experience"}
            className={`${styles.segBtn} ${kind === "experience" ? styles.segBtnActive : ""}`}
            onClick={() => setKind("experience")}
          >
            Experience
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "lodging"}
            className={`${styles.segBtn} ${kind === "lodging" ? styles.segBtnActive : ""}`}
            onClick={() => setKind("lodging")}
          >
            Lodging
          </button>
        </div>
      </div>

      {/* Common fields */}
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            name="name"
            className={styles.input}
            placeholder={kind === "lodging" ? "e.g. Casa del Volcán" : "e.g. Sunrise Kayak Tours"}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Zone</span>
          <select name="zone_id" className={styles.select} required defaultValue="">
            <option value="" disabled>
              Choose a zone…
            </option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({z.region})
              </option>
            ))}
          </select>
        </label>
      </div>

      {kind === "experience" ? (
        <>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Category</span>
              <select name="category" className={styles.select} required defaultValue="nature">
                {EXPERIENCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {cap(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Weather / timing dependency</span>
              <select name="dependency" className={styles.select} defaultValue="">
                <option value="">None</option>
                {DEPENDENCIES.map((d) => (
                  <option key={d} value={d}>
                    {cap(d.replace(/_/g, " "))}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Open days</span>
            <div className={styles.dayRow}>
              {DAYS.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(d)}
                  aria-pressed={days.includes(d)}
                  className={`${styles.dayChip} ${days.includes(d) ? styles.dayChipActive : ""}`}
                >
                  {DAY_LABEL[d]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Opens</span>
              <input name="open_from" type="time" className={styles.input} defaultValue="08:00" required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Closes</span>
              <input name="open_to" type="time" className={styles.input} defaultValue="17:00" required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Duration (min)</span>
              <input name="duration_min" type="number" min={15} step={15} className={styles.input} defaultValue={120} required />
            </label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Net price (per person, USD)</span>
              <input name="net_price" type="number" min={0} step="0.01" className={styles.input} defaultValue={25} required />
              <span className={styles.hint}>Your cost. Rumbo adds its markup on top.</span>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Capacity per slot</span>
              <input name="capacity_per_slot" type="number" min={1} step={1} className={styles.input} defaultValue={8} required />
            </label>
          </div>

          <details className={styles.advanced}>
            <summary className={styles.advancedSummary}>Advanced (engine tuning)</summary>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Partner type</span>
                <select name="provider_type" className={styles.select} defaultValue="informal">
                  {PROVIDER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {cap(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Confirmation mode</span>
                <select name="confirmation_mode" className={styles.select} defaultValue="on_request">
                  {CONFIRMATION_MODES.map((m) => (
                    <option key={m} value={m}>
                      {cap(m.replace(/_/g, " "))}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Reliability (0–1)</span>
                <input name="reliability_score" type="number" min={0} max={1} step="0.01" className={styles.input} defaultValue={0.85} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Base popularity (0–1)</span>
                <input name="base_popularity" type="number" min={0} max={1} step="0.01" className={styles.input} defaultValue={0.6} />
              </label>
            </div>
          </details>

          <details className={styles.advanced}>
            <summary className={styles.advancedSummary}>Personalization (optional)</summary>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Special occasions</span>
                <input name="special_occasions" className={styles.input} placeholder="e.g. anniversaries, birthdays" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Dietary options</span>
                <input name="dietary_options" className={styles.input} placeholder="e.g. vegetarian, gluten-free" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Privacy options</span>
                <input name="privacy_options" className={styles.input} placeholder="e.g. private group available" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Extras on request</span>
                <input name="extras_on_request" className={styles.input} placeholder="e.g. photographer, transport" />
              </label>
            </div>
          </details>
        </>
      ) : (
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Tier</span>
            <select name="tier" className={styles.select} defaultValue="comfort">
              {LODGING_TIERS.map((t) => (
                <option key={t} value={t}>
                  {cap(t)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Net price per night (USD)</span>
            <input name="net_price_per_night" type="number" min={0} step="0.01" className={styles.input} defaultValue={72} required />
            <span className={styles.hint}>Your cost. Rumbo adds its markup on top.</span>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Capacity (guests)</span>
            <input name="capacity" type="number" min={1} step={1} className={styles.input} defaultValue={4} required />
          </label>
        </div>
      )}

      <div className={styles.submitRow}>
        <button type="submit" className={styles.submitBtn} disabled={pending}>
          {pending ? "Saving…" : "Add to catalog"}
        </button>
        {msg && (
          <span className={`${styles.formMsg} ${msg.ok ? styles.formMsgOk : styles.formMsgErr}`}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
