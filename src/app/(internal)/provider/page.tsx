import { getProviderInbox, listProviders } from "@/lib/provider";
import ProviderPortal from "./ProviderPortal";
import styles from "./provider.module.css";

export const dynamic = "force-dynamic";

/**
 * Provider portal (SBI-11). Internal tool: an availability-request inbox where
 * the acting provider confirms/declines. No login — a provider selector picks
 * the acting context, carried in the `?provider=` query param.
 *
 * Business rule: only the provider NET rate is ever shown here — never the
 * client price or the markup.
 */
export default async function ProviderPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider: selectedId } = await searchParams;
  const providers = await listProviders();

  const activeId = selectedId && providers.some((p) => p.id === selectedId)
    ? selectedId
    : providers[0]?.id;

  const inbox = activeId ? await getProviderInbox(activeId) : null;

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

      <ProviderPortal
        providers={providers.map((p) => ({
          id: p.id,
          name: p.name,
          zone_name: p.zone_name,
          provider_type: p.provider_type,
          confirmation_mode: p.confirmation_mode,
        }))}
        activeId={activeId ?? ""}
        inbox={inbox}
      />
    </div>
  );
}
