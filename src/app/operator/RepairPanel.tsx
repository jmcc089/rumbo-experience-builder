"use client";
// Rumbo · SBI-13: repair demo panel. Lets the operator simulate a disruption
// on a paid order and trigger the engine's repair — the demo trigger surface
// for "one engine, two uses" (repair is a triggered action, not a daemon).
import { useState, useTransition } from "react";
import type { OrderRepairRow } from "@/lib/operator";
import { triggerDisruption, triggerRepair } from "./actions";
import styles from "./operator.module.css";

export default function RepairPanel({ orders }: { orders: OrderRepairRow[] }) {
  const [pending, startTransition] = useTransition();
  const [messages, setMessages] = useState<Record<string, string>>({});

  function runDisrupt(orderId: string) {
    startTransition(async () => {
      const result = await triggerDisruption(orderId);
      setMessages((m) => ({
        ...m,
        [orderId]: result.disrupted
          ? `Disrupted day ${result.dayIndex} (reliability ${result.reliabilityScore?.toFixed(2)})`
          : result.reason ?? "Could not disrupt this order",
      }));
    });
  }

  function runRepair(orderId: string) {
    startTransition(async () => {
      const result = await triggerRepair(orderId);
      setMessages((m) => ({
        ...m,
        [orderId]: result.repaired
          ? `Repaired day ${result.dayIndex} — new total $${result.newClientTotal}`
          : result.reason ?? "Repair failed",
      }));
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Repair demo</h2>
        <span className={styles.count}>{orders.length}</span>
      </div>

      {orders.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No paid orders yet</p>
          <p className={styles.emptySub}>Confirmed trips will appear here for the repair demo.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Order</th>
                <th>Booked / Disrupted / Replaced</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className={styles.client}>{o.email}</span>
                  </td>
                  <td className={styles.dates}>${o.client_price}</td>
                  <td className={styles.dates}>
                    {o.booked_experience_count} / {o.disrupted_count} / {o.replaced_count}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => runDisrupt(o.id)}
                        className={styles.pill}
                      >
                        Simulate disruption
                      </button>
                      <button
                        type="button"
                        disabled={pending || o.disrupted_count === 0}
                        onClick={() => runRepair(o.id)}
                        className={styles.pill}
                      >
                        Repair
                      </button>
                    </div>
                    {messages[o.id] && <p className={styles.emptySub}>{messages[o.id]}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
