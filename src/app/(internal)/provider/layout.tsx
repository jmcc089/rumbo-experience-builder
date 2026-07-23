import type { ReactNode } from "react";
import { listProviders } from "@/lib/provider";
import ProviderSidebar from "./ProviderSidebar";
import styles from "./provider.module.css";

export const dynamic = "force-dynamic";

/**
 * Shared shell for the provider portal: fixed cobalt topbar + fixed sidebar
 * (same pattern as the operator portal). The sidebar carries the "Viewing as"
 * demo switcher and the section nav; the acting provider is kept in the
 * `?provider=` query param across all three sections.
 */
export default async function ProviderLayout({ children }: { children: ReactNode }) {
  const providers = await listProviders();
  const options = providers.map((p) => ({ id: p.id, name: p.name, zone_name: p.zone_name }));

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <span className={`rumbo-logo ${styles.logo}`}>
            Rumbo<span className="dot">.</span>
          </span>
          <span className={styles.portalTag}>Provider portal</span>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <ProviderSidebar providers={options} defaultId={options[0]?.id ?? ""} />
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
