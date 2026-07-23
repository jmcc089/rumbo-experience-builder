import { getZones, getSupplyCatalog } from "@/lib/operator/admin";
import AddBusinessForm from "./AddBusinessForm";
import SupplyLists from "./SupplyLists";
import styles from "../operator.module.css";

export const dynamic = "force-dynamic";

/**
 * Providers section: register catalog supply (experience businesses or lodging)
 * and see what's already listed. This is the operator's only writing surface.
 */
export default async function ProvidersPage() {
  const [zones, catalog] = await Promise.all([getZones(), getSupplyCatalog()]);

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

      {/* Existing supply — toggle between the two lists */}
      <SupplyLists experiences={catalog.experiences} lodging={catalog.lodging} />
    </>
  );
}
