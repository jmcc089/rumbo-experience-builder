"use client";
// Provider · Services manager. An "Add an experience" form plus the business's
// experience list, each editable inline. Reuses the same validated write path
// the operator uses, scoped to the acting provider.
import { useState, useTransition } from "react";
import type { ProviderExperienceRow } from "@/lib/provider";
import {
  EXPERIENCE_CATEGORIES,
  DEPENDENCIES,
  DAYS,
  type ZoneOption,
} from "@/lib/operator/catalog-fields";
import { addExperience, editExperience } from "./actions";
import styles from "../provider.module.css";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const label = (s: string) => cap(s.replace(/_/g, " "));

type Msg = { ok: boolean; text: string } | null;

export default function ServicesManager({
  providerId,
  experiences,
  zones,
  defaultZoneId,
}: {
  providerId: string;
  experiences: ProviderExperienceRow[];
  zones: ZoneOption[];
  defaultZoneId: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Add an experience</h2>
        </div>
        <div className={styles.panel}>
          <ExperienceForm
            providerId={providerId}
            zones={zones}
            mode="add"
            defaultZoneId={defaultZoneId}
            onDone={() => {}}
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Your experiences</h2>
          <span className={styles.count}>{experiences.length}</span>
        </div>

        {experiences.length === 0 ? (
          <div className={styles.emptyCard}>
            <p className={styles.emptyTitle}>No experiences yet</p>
            <p className={styles.emptySub}>Add your first experience above.</p>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {experiences.map((e) =>
              editingId === e.id ? (
                <div key={e.id} className={styles.card}>
                  <ExperienceForm
                    providerId={providerId}
                    zones={zones}
                    mode="edit"
                    experience={e}
                    onDone={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div key={e.id} className={styles.card}>
                  <span className={styles.svcName}>{e.name}</span>
                  <div className={styles.svcMeta}>
                    <span className={styles.svcMetaRow}>
                      {cap(e.category)} · {e.zone_name}
                    </span>
                    <span className={styles.svcMetaRow}>
                      {e.open_from}–{e.open_to} · {e.duration_min} min · up to {e.capacity_per_slot}
                    </span>
                    <span className={styles.svcMetaRow}>
                      {e.open_days}
                      {e.dependency ? ` · ${label(e.dependency)}` : ""}
                    </span>
                  </div>
                  <span className={styles.svcPrice}>{usd(e.net_price)} net</span>
                  <button className={styles.editBtn} onClick={() => setEditingId(e.id)}>
                    Edit
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </>
  );
}

function ExperienceForm({
  providerId,
  zones,
  mode,
  experience,
  defaultZoneId,
  onDone,
}: {
  providerId: string;
  zones: ZoneOption[];
  mode: "add" | "edit";
  experience?: ProviderExperienceRow;
  defaultZoneId?: string;
  onDone: () => void;
}) {
  const e = experience;
  const initialDays = e
    ? e.open_days.split(",").map((s) => s.trim()).filter(Boolean)
    : ["sat", "sun"];
  const [days, setDays] = useState<string[]>(initialDays);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  function toggleDay(d: string) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    days.forEach((d) => fd.append("open_days", d));
    startTransition(async () => {
      const result =
        mode === "add"
          ? await addExperience(providerId, fd)
          : await editExperience(providerId, e!.id, fd);
      setMsg({ ok: result.ok, text: result.message });
      if (result.ok) {
        if (mode === "add") {
          form.reset();
          setDays(["sat", "sun"]);
        }
        onDone();
      }
    });
  }

  const zoneDefault = e?.zone_id ?? defaultZoneId ?? "";

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.formGrid}>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldLabel}>Name</span>
          <input name="name" className={styles.input} defaultValue={e?.name ?? ""} required />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Zone</span>
          <select name="zone_id" className={styles.input} defaultValue={zoneDefault} required>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} · {z.region}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Category</span>
          <select name="category" className={styles.input} defaultValue={e?.category ?? "nature"} required>
            {EXPERIENCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {cap(c)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Net price (USD)</span>
          <input
            name="net_price"
            type="number"
            min={0}
            step="1"
            className={styles.input}
            defaultValue={e?.net_price ?? 20}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Duration (min)</span>
          <input
            name="duration_min"
            type="number"
            min={1}
            step={1}
            className={styles.input}
            defaultValue={e?.duration_min ?? 120}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Capacity per slot</span>
          <input
            name="capacity_per_slot"
            type="number"
            min={1}
            step={1}
            className={styles.input}
            defaultValue={e?.capacity_per_slot ?? 8}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Opens</span>
          <input
            name="open_from"
            type="time"
            className={styles.input}
            defaultValue={e?.open_from ?? "08:00"}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Closes</span>
          <input
            name="open_to"
            type="time"
            className={styles.input}
            defaultValue={e?.open_to ?? "17:00"}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Dependency</span>
          <select name="dependency" className={styles.input} defaultValue={e?.dependency ?? ""}>
            <option value="">None</option>
            {DEPENDENCIES.map((d) => (
              <option key={d} value={d}>
                {label(d)}
              </option>
            ))}
          </select>
        </label>
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldLabel}>Open days</span>
          <div className={styles.dayRow}>
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`${styles.dayChip} ${days.includes(d) ? styles.dayChipOn : ""}`}
                onClick={() => toggleDay(d)}
                aria-pressed={days.includes(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.submitBtn} disabled={pending}>
          {pending ? "Saving…" : mode === "add" ? "Add experience" : "Save changes"}
        </button>
        {mode === "edit" && (
          <button type="button" className={styles.cancelBtn} onClick={onDone} disabled={pending}>
            Cancel
          </button>
        )}
        {msg && (
          <span className={`${styles.formMsg} ${msg.ok ? styles.formMsgOk : styles.formMsgErr}`}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
