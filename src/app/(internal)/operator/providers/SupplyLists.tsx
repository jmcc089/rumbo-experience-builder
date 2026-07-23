"use client";
// Toggles between the existing Experiences list and Lodging list with a
// full-width segmented control (same control as the add-business type toggle).
import { useState } from "react";
import type { ExperienceCatalogRow, LodgingCatalogRow } from "@/lib/operator/admin";
import styles from "../operator.module.css";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function SupplyLists({
  experiences,
  lodging,
}: {
  experiences: ExperienceCatalogRow[];
  lodging: LodgingCatalogRow[];
}) {
  const [tab, setTab] = useState<"experiences" | "lodging">("experiences");

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
                </tr>
              </thead>
              <tbody>
                {experiences.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className={styles.client}>{e.name}</span>
                      <span className={styles.travelers}>
                        {cap(e.category)} · {e.provider_name}
                      </span>
                    </td>
                    <td className={styles.dates}>{e.zone_name}</td>
                    <td className={styles.numCol}>
                      <span className={styles.value}>{usd(e.net_price)}</span>
                    </td>
                  </tr>
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
              </tr>
            </thead>
            <tbody>
              {lodging.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className={styles.client}>{l.name}</span>
                    <span className={styles.travelers}>{cap(l.tier)}</span>
                  </td>
                  <td className={styles.dates}>{l.zone_name}</td>
                  <td className={styles.numCol}>
                    <span className={styles.value}>{usd(l.net_price_per_night)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
