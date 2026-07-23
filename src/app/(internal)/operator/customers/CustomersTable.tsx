"use client";
// Customers table with an inline edit form per row. The edit button (last
// column) expands an editable row; saving calls the editCustomer server action.
import { useState, useTransition } from "react";
import type { CustomerRow, RequestStatus } from "@/lib/operator";
import { editCustomer } from "./actions";
import styles from "../operator.module.css";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STATUS_LABEL: Record<RequestStatus, string> = {
  building: "Building",
  awaiting_providers: "Awaiting providers",
  proposals_ready: "Proposals sent",
  no_availability: "No availability",
  paid: "Paid",
  expired: "Expired",
};

function StatusPill({ status }: { status: RequestStatus }) {
  const cls =
    status === "paid"
      ? styles.pillPaid
      : status === "proposals_ready"
      ? styles.pillSent
      : status === "expired" || status === "no_availability"
      ? styles.pillExpired
      : styles.pillBuilding;
  return <span className={`${styles.pill} ${cls}`}>{STATUS_LABEL[status] ?? status}</span>;
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString("en-US", opts);
  const e = new Date(`${end}T00:00:00`).toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}

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

export default function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await editCustomer(id, fd);
      setMsg({ ok: result.ok, text: result.message });
      if (result.ok) setEditingId(null);
    });
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Trip</th>
            <th>Preferences</th>
            <th className={styles.numCol}>Budget</th>
            <th className={styles.numCol}>Paid</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <FragmentRow
              key={c.id}
              c={c}
              editing={editingId === c.id}
              pending={pending}
              msg={editingId === c.id ? msg : null}
              onEdit={() => {
                setMsg(null);
                setEditingId(c.id);
              }}
              onCancel={() => {
                setMsg(null);
                setEditingId(null);
              }}
              onSubmit={onSubmit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({
  c,
  editing,
  pending,
  msg,
  onEdit,
  onCancel,
  onSubmit,
}: {
  c: CustomerRow;
  editing: boolean;
  pending: boolean;
  msg: { ok: boolean; text: string } | null;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, id: string) => void;
}) {
  return (
    <>
      <tr>
        <td>
          <span className={styles.client}>{c.name || "—"}</span>
          <span className={styles.travelers}>{c.email}</span>
        </td>
        <td className={styles.dates}>
          {formatRange(c.arrival_date, c.departure_date)}
          <span className={styles.travelers}>
            {c.travelers} {c.travelers === 1 ? "traveler" : "travelers"}
            {c.group_composition ? ` · ${cap(c.group_composition)}` : ""}
          </span>
        </td>
        <td>
          {c.interests.length > 0 ? (
            <span className={styles.tags}>
              {c.interests.map((i) => (
                <span key={i} className={styles.tag}>
                  {cap(i)}
                </span>
              ))}
            </span>
          ) : (
            <span className={styles.travelers}>—</span>
          )}
          {c.pace && <span className={styles.travelers}>{cap(c.pace)} pace</span>}
        </td>
        <td className={styles.numCol}>
          <span className={styles.value}>{usd(c.budget_total)}</span>
        </td>
        <td className={styles.numCol}>
          {c.paid_total != null ? (
            <span className={styles.value}>{usd(c.paid_total)}</span>
          ) : (
            <span className={styles.travelers}>—</span>
          )}
        </td>
        <td>
          <StatusPill status={c.status} />
        </td>
        <td>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onEdit}
            aria-label={`Edit ${c.name || c.email}`}
            aria-expanded={editing}
          >
            <EditIcon />
          </button>
        </td>
      </tr>

      {editing && (
        <tr className={styles.editRow}>
          <td colSpan={7}>
            <form className={styles.editForm} onSubmit={(e) => onSubmit(e, c.id)}>
              <div className={styles.editGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Name</span>
                  <input name="name" className={styles.input} defaultValue={c.name} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Email</span>
                  <input name="email" type="email" className={styles.input} defaultValue={c.email} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Arrival</span>
                  <input name="arrival_date" type="date" className={styles.input} defaultValue={c.arrival_date} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Departure</span>
                  <input name="departure_date" type="date" className={styles.input} defaultValue={c.departure_date} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Travelers</span>
                  <input name="travelers" type="number" min={1} step={1} className={styles.input} defaultValue={c.travelers} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Budget (USD)</span>
                  <input name="budget_total" type="number" min={0} step="1" className={styles.input} defaultValue={c.budget_total} required />
                </label>
              </div>
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
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
