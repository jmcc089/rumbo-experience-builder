import { getCustomers } from "@/lib/operator";
import CustomersTable from "./CustomersTable";
import styles from "../operator.module.css";

export const dynamic = "force-dynamic";

/**
 * Customers section: every client request with its trip data. One row per
 * customer, newest first; each row has an inline edit form.
 */
export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Customers</h1>
        <p className={styles.pageSub}>
          Everyone who has requested a trip, with their preferences and status.
        </p>
      </div>

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>All customers</h2>
        <span className={styles.count}>{customers.length}</span>
      </div>

      {customers.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No customers yet</p>
          <p className={styles.emptySub}>Client requests will appear here as they come in.</p>
        </div>
      ) : (
        <CustomersTable customers={customers} />
      )}
    </>
  );
}
