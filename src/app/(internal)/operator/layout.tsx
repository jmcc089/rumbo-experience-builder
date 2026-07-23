import type { ReactNode } from "react";
import OperatorNav from "./OperatorNav";
import styles from "./operator.module.css";

/**
 * Shared shell for the operator portal: cobalt topbar + left sidebar nav.
 * The three sections (Dashboard, Customers, Providers) render into {children}.
 * Read-only surfaces except Providers, which writes to the catalog. No login,
 * consistent with the rest of Rumbo.
 */
export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <span className={`rumbo-logo ${styles.logo}`}>
            Rumbo<span className="dot">.</span>
          </span>
          <span className={styles.portalTag}>Operator</span>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <OperatorNav />
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
