import { getProviderInbox, getProviderBookings, listProviders } from "@/lib/provider";
import BookingsView from "./ProviderPortal";
import styles from "./provider.module.css";

export const dynamic = "force-dynamic";

/**
 * Provider portal · Bookings (SBI-11). The acting provider's availability-request
 * inbox plus the paid jobs they have to deliver. No login — the acting context
 * is the `?provider=` query param, driven by the sidebar's "Viewing as" switcher.
 *
 * Business rule: only the provider NET rate is ever shown here — never the
 * client price or the markup.
 */
export default async function ProviderBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider: selectedId } = await searchParams;
  const providers = await listProviders();
  const activeId =
    selectedId && providers.some((p) => p.id === selectedId) ? selectedId : providers[0]?.id;

  const [inbox, bookings] = activeId
    ? await Promise.all([getProviderInbox(activeId), getProviderBookings(activeId)])
    : [null, []];

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Bookings</h1>
        <p className={styles.pageSub}>
          Availability requests and the paid jobs you need to deliver.
        </p>
      </div>

      {inbox ? (
        <BookingsView inbox={inbox} bookings={bookings} />
      ) : (
        <p className={styles.emptyNote}>No provider selected.</p>
      )}
    </>
  );
}
