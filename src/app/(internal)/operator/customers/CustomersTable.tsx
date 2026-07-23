"use client";
// Orders table. Each row can be cancelled — and since this prototype has no
// cancellation status or soft-delete flag, a cancel is a hard delete, so the
// button opens a confirm step before calling the cancelOrder server action.
import { useState, useTransition } from "react";
import type { CustomerRow, RequestStatus } from "@/lib/operator";
import { cancelOrder } from "./actions";
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

type Msg = { ok: boolean; text: string } | null;

export default function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  function onCancel(id: string) {
    startTransition(async () => {
      const result = await cancelOrder(id);
      setMsg({ ok: result.ok, text: result.message });
      if (result.ok) setConfirmingId(null);
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
            <OrderRow
              key={c.id}
              c={c}
              confirming={confirmingId === c.id}
              pending={pending}
              msg={confirmingId === c.id ? msg : null}
              onAsk={() => {
                setMsg(null);
                setConfirmingId(c.id);
              }}
              onKeep={() => {
                setMsg(null);
                setConfirmingId(null);
              }}
              onCancel={() => onCancel(c.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderRow({
  c,
  confirming,
  pending,
  msg,
  onAsk,
  onKeep,
  onCancel,
}: {
  c: CustomerRow;
  confirming: boolean;
  pending: boolean;
  msg: Msg;
  onAsk: () => void;
  onKeep: () => void;
  onCancel: () => void;
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
            className={styles.cancelOrderBtn}
            onClick={onAsk}
            aria-label={`Cancel order for ${c.name || c.email}`}
            aria-expanded={confirming}
          >
            Cancel order
          </button>
        </td>
      </tr>

      {confirming && (
        <tr className={styles.confirmRow}>
          <td colSpan={7}>
            <div className={styles.confirmBox}>
              <span className={styles.confirmText}>
                This permanently deletes the order and its records. This can&apos;t be undone.
              </span>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={onCancel}
                disabled={pending}
              >
                {pending ? "Cancelling…" : "Yes, cancel order"}
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onKeep}
                disabled={pending}
              >
                Keep
              </button>
              {msg && !msg.ok && (
                <span className={`${styles.formMsg} ${styles.formMsgErr}`}>{msg.text}</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
