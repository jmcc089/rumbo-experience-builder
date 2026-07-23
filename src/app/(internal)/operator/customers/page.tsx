import { getCustomers } from "@/lib/operator";
import CustomersTable from "./CustomersTable";
import styles from "../operator.module.css";

export const dynamic = "force-dynamic";

/**
 * Orders section: every client request with its trip data. One row per order,
 * newest first; each row can be cancelled (a hard delete).
 */
export default async function OrdersPage() {
  const customers = await getCustomers();

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Orders</h1>
        <p className={styles.pageSub}>
          Every trip request, with its preferences and status.
        </p>
      </div>

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>All orders</h2>
        <span className={styles.count}>{customers.length}</span>
      </div>

      {customers.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No orders yet</p>
          <p className={styles.emptySub}>Client requests will appear here as they come in.</p>
        </div>
      ) : (
        <CustomersTable customers={customers} />
      )}
    </>
  );
}
