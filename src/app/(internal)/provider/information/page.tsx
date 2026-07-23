import { getProviderProfile, listProviders } from "@/lib/provider";
import { getZones } from "@/lib/operator/admin";
import InformationForm from "./InformationForm";
import styles from "../provider.module.css";

export const dynamic = "force-dynamic";

/**
 * Provider · Information. The acting business edits its own profile: name,
 * location (zone), and the personalization Rumbo uses for its guests. Service
 * hours are per experience and live under Services.
 */
export default async function ProviderInformationPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider: selectedId } = await searchParams;
  const providers = await listProviders();
  const activeId =
    selectedId && providers.some((p) => p.id === selectedId) ? selectedId : providers[0]?.id;

  const [profile, zones] = activeId
    ? await Promise.all([getProviderProfile(activeId), getZones()])
    : [null, []];

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Information</h1>
        <p className={styles.pageSub}>
          Your business details and personalization. Service hours are set per experience under
          Services.
        </p>
      </div>

      {profile && activeId ? (
        <InformationForm providerId={activeId} profile={profile} zones={zones} />
      ) : (
        <p className={styles.emptyNote}>No provider selected.</p>
      )}
    </>
  );
}
