import { getProviderCatalog, listProviders } from "@/lib/provider";
import { getZones } from "@/lib/operator/admin";
import ServicesManager from "./ServicesManager";
import styles from "../provider.module.css";

export const dynamic = "force-dynamic";

/**
 * Provider · Services. The acting business's own experience catalog: list each
 * experience, edit its price and details, or add a new one. Scoped to the
 * `?provider=` acting context. Lodging is not managed here — in the current
 * schema lodging has no owning provider (see docs).
 */
export default async function ProviderServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider: selectedId } = await searchParams;
  const providers = await listProviders();
  const activeId =
    selectedId && providers.some((p) => p.id === selectedId) ? selectedId : providers[0]?.id;

  const [experiences, zones] = activeId
    ? await Promise.all([getProviderCatalog(activeId), getZones()])
    : [[], []];
  const activeName = providers.find((p) => p.id === activeId)?.name ?? "";
  const defaultZoneId = experiences[0]?.zone_id ?? zones[0]?.id ?? "";

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Services</h1>
        <p className={styles.pageSub}>
          The experiences {activeName} offers. Edit prices and details, or add a new one.
        </p>
      </div>

      {activeId ? (
        <ServicesManager
          providerId={activeId}
          experiences={experiences}
          zones={zones}
          defaultZoneId={defaultZoneId}
        />
      ) : (
        <p className={styles.emptyNote}>No provider selected.</p>
      )}
    </>
  );
}
