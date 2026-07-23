import { getZones, getSupplyCatalog } from "@/lib/operator/admin";
import AddBusinessForm from "./AddBusinessForm";
import styles from "../operator.module.css";

export const dynamic = "force-dynamic";

/**
 * Providers section: register catalog supply (experience businesses or lodging)
 * and see what's already listed. This is the operator's only writing surface.
 */
export default async function ProvidersPage() {
  const [zones, catalog] = await Promise.all([getZones(), getSupplyCatalog()]);

  const usd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Providers</h1>
        <p className={styles.pageSub}>
          Register the businesses Rumbo can book. New supply appears in future itineraries.
        </p>
      </div>

      {/* Add form */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Add a business</h2>
        </div>
        <div className={styles.panel}>
          <AddBusinessForm zones={zones} />
        </div>
      </section>

      {/* Existing supply */}
      <div className={styles.columns}>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Experiences</h2>
            <span className={styles.count}>{catalog.experiences.length}</span>
          </div>
          {catalog.experiences.length === 0 ? (
            <div className={styles.emptyCard}>
              <p className={styles.emptyTitle}>No experiences yet</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Experience</th>
                    <th>Zone</th>
                    <th className={styles.numCol}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.experiences.map((e) => (
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
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Lodging</h2>
            <span className={styles.count}>{catalog.lodging.length}</span>
          </div>
          {catalog.lodging.length === 0 ? (
            <div className={styles.emptyCard}>
              <p className={styles.emptyTitle}>No lodging yet</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Lodging</th>
                    <th>Zone</th>
                    <th className={styles.numCol}>Night</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.lodging.map((l) => (
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
        </section>
      </div>
    </>
  );
}
