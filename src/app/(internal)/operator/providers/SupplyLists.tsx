"use client";
// Toggles between the existing Experiences list and Lodging list with a
// full-width segmented control, and lets the operator edit any row inline
// (pencil button → expandable form, same pattern as the Customers table).
import { useState, useTransition } from "react";
import type { ExperienceCatalogRow, LodgingCatalogRow } from "@/lib/operator/admin";
import {
  EXPERIENCE_CATEGORIES,
  DEPENDENCIES,
  LODGING_TIERS,
  type ZoneOption,
} from "@/lib/operator/catalog-fields";
import { editExperience, editLodging } from "./actions";
import styles from "../operator.module.css";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const label = (s: string) => cap(s.replace(/_/g, " "));

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3z M13.5 6.5l3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Msg = { ok: boolean; text: string } | null;

export default function SupplyLists({
  experiences,
  lodging,
  zones,
}: {
  experiences: ExperienceCatalogRow[];
  lodging: LodgingCatalogRow[];
  zones: ZoneOption[];
}) {
  const [tab, setTab] = useState<"experiences" | "lodging">("experiences");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  function openEdit(id: string) {
    setMsg(null);
    setEditingId(id);
  }
  function closeEdit() {
    setMsg(null);
    setEditingId(null);
  }

  function submitExperience(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await editExperience(id, fd);
      setMsg({ ok: result.ok, text: result.message });
      if (result.ok) setEditingId(null);
    });
  }
  function submitLodging(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await editLodging(id, fd);
      setMsg({ ok: result.ok, text: result.message });
      if (result.ok) setEditingId(null);
    });
  }

  return (
    <>
      <div className={styles.segmented} role="tablist" style={{ marginBottom: 18 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "experiences"}
          className={`${styles.segBtn} ${tab === "experiences" ? styles.segBtnActive : ""}`}
          onClick={() => setTab("experiences")}
        >
          Experiences ({experiences.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "lodging"}
          className={`${styles.segBtn} ${tab === "lodging" ? styles.segBtnActive : ""}`}
          onClick={() => setTab("lodging")}
        >
          Lodging ({lodging.length})
        </button>
      </div>

      {tab === "experiences" ? (
        experiences.length === 0 ? (
          <div className={styles.emptyCard}>
            <p className={styles.emptyTitle}>No experiences yet</p>
          </div>
        ) : (
          <div className={styles.tableFlush}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Experience</th>
                  <th>Zone</th>
                  <th className={styles.numCol}>Net</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {experiences.map((e) => (
                  <ExperienceRow
                    key={e.id}
                    exp={e}
                    zones={zones}
                    editing={editingId === e.id}
                    pending={pending}
                    msg={editingId === e.id ? msg : null}
                    onEdit={() => openEdit(e.id)}
                    onCancel={closeEdit}
                    onSubmit={submitExperience}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : lodging.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No lodging yet</p>
        </div>
      ) : (
        <div className={styles.tableFlush}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Lodging</th>
                <th>Zone</th>
                <th className={styles.numCol}>Night</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lodging.map((l) => (
                <LodgingRow
                  key={l.id}
                  lodge={l}
                  zones={zones}
                  editing={editingId === l.id}
                  pending={pending}
                  msg={editingId === l.id ? msg : null}
                  onEdit={() => openEdit(l.id)}
                  onCancel={closeEdit}
                  onSubmit={submitLodging}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ZoneField({ zones, defaultValue }: { zones: ZoneOption[]; defaultValue: string }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>Zone</span>
      <select name="zone_id" className={styles.input} defaultValue={defaultValue} required>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name} · {z.region}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubmitRow({
  pending,
  msg,
  onCancel,
}: {
  pending: boolean;
  msg: Msg;
  onCancel: () => void;
}) {
  return (
    <div className={styles.submitRow}>
      <button type="submit" className={styles.submitBtn} disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
      <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      {msg && (
        <span className={`${styles.formMsg} ${msg.ok ? styles.formMsgOk : styles.formMsgErr}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}

function ExperienceRow({
  exp,
  zones,
  editing,
  pending,
  msg,
  onEdit,
  onCancel,
  onSubmit,
}: {
  exp: ExperienceCatalogRow;
  zones: ZoneOption[];
  editing: boolean;
  pending: boolean;
  msg: Msg;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, id: string) => void;
}) {
  return (
    <>
      <tr>
        <td>
          <span className={styles.client}>{exp.name}</span>
          <span className={styles.travelers}>
            {cap(exp.category)} · {exp.provider_name}
          </span>
        </td>
        <td className={styles.dates}>{exp.zone_name}</td>
        <td className={styles.numCol}>
          <span className={styles.value}>{usd(exp.net_price)}</span>
        </td>
        <td>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onEdit}
            aria-label={`Edit ${exp.name}`}
            aria-expanded={editing}
          >
            <EditIcon />
          </button>
        </td>
      </tr>

      {editing && (
        <tr className={styles.editRow}>
          <td colSpan={4}>
            <form className={styles.editForm} onSubmit={(e) => onSubmit(e, exp.id)}>
              <div className={styles.editGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Name</span>
                  <input name="name" className={styles.input} defaultValue={exp.name} required />
                </label>
                <ZoneField zones={zones} defaultValue={exp.zone_id} />
                <label className={styles.field}>
                  <span className={styles.label}>Category</span>
                  <select name="category" className={styles.input} defaultValue={exp.category} required>
                    {EXPERIENCE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {cap(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Net price (USD)</span>
                  <input name="net_price" type="number" min={0} step="1" className={styles.input} defaultValue={exp.net_price} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Duration (min)</span>
                  <input name="duration_min" type="number" min={1} step={1} className={styles.input} defaultValue={exp.duration_min} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Capacity per slot</span>
                  <input name="capacity_per_slot" type="number" min={1} step={1} className={styles.input} defaultValue={exp.capacity_per_slot} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Opens</span>
                  <input name="open_from" type="time" className={styles.input} defaultValue={exp.open_from} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Closes</span>
                  <input name="open_to" type="time" className={styles.input} defaultValue={exp.open_to} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Dependency</span>
                  <select name="dependency" className={styles.input} defaultValue={exp.dependency ?? ""}>
                    <option value="">None</option>
                    {DEPENDENCIES.map((d) => (
                      <option key={d} value={d}>
                        {label(d)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <SubmitRow pending={pending} msg={msg} onCancel={onCancel} />
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function LodgingRow({
  lodge,
  zones,
  editing,
  pending,
  msg,
  onEdit,
  onCancel,
  onSubmit,
}: {
  lodge: LodgingCatalogRow;
  zones: ZoneOption[];
  editing: boolean;
  pending: boolean;
  msg: Msg;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, id: string) => void;
}) {
  return (
    <>
      <tr>
        <td>
          <span className={styles.client}>{lodge.name}</span>
          <span className={styles.travelers}>{cap(lodge.tier)}</span>
        </td>
        <td className={styles.dates}>{lodge.zone_name}</td>
        <td className={styles.numCol}>
          <span className={styles.value}>{usd(lodge.net_price_per_night)}</span>
        </td>
        <td>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onEdit}
            aria-label={`Edit ${lodge.name}`}
            aria-expanded={editing}
          >
            <EditIcon />
          </button>
        </td>
      </tr>

      {editing && (
        <tr className={styles.editRow}>
          <td colSpan={4}>
            <form className={styles.editForm} onSubmit={(e) => onSubmit(e, lodge.id)}>
              <div className={styles.editGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Name</span>
                  <input name="name" className={styles.input} defaultValue={lodge.name} required />
                </label>
                <ZoneField zones={zones} defaultValue={lodge.zone_id} />
                <label className={styles.field}>
                  <span className={styles.label}>Tier</span>
                  <select name="tier" className={styles.input} defaultValue={lodge.tier} required>
                    {LODGING_TIERS.map((t) => (
                      <option key={t} value={t}>
                        {cap(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Price / night (USD)</span>
                  <input name="net_price_per_night" type="number" min={0} step="1" className={styles.input} defaultValue={lodge.net_price_per_night} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Capacity</span>
                  <input name="capacity" type="number" min={1} step={1} className={styles.input} defaultValue={lodge.capacity} required />
                </label>
              </div>
              <SubmitRow pending={pending} msg={msg} onCancel={onCancel} />
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
