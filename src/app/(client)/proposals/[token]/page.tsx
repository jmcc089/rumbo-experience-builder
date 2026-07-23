import Link from "next/link";
import Header from "../../components/Header";
import { getProposalsPageView } from "@/lib/booking";
import ProposalsClient from "./ProposalsClient";
import Confirmation from "./Confirmation";
import styles from "./proposals.module.css";

// The hold is request-time state; never statically cache this route.
export const dynamic = "force-dynamic";

export default async function ProposalsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getProposalsPageView(token);

  if (view.status === "ready" && view.proposals && view.proposals.length > 0) {
    return (
      <ProposalsClient
        token={token}
        proposals={view.proposals}
        expiresAt={view.expiresAt ?? null}
        travelers={view.travelers ?? 1}
      />
    );
  }

  if (view.status === "paid") {
    return (
      <>
        <Header showCta={false} />
        <main className={styles.stateMain}>
          {view.chosen ? (
            <Confirmation proposal={view.chosen} travelers={view.travelers ?? 1} alreadyBooked />
          ) : (
            <StatePanel
              eyebrow="Already booked"
              title="This trip is confirmed"
              body="This request has already been paid and confirmed. Your itinerary and confirmation were sent to your email."
            />
          )}
        </main>
      </>
    );
  }

  // Non-happy states — calm, on-brand panels.
  return (
    <>
      <Header showCta={false} />
      <main className={styles.stateMain}>
        {view.status === "not_ready" && (
          <StatePanel
            eyebrow="Still building"
            title="Your itineraries aren’t ready yet"
            body="Our coordinators are still confirming availability with local providers. We’ll email you the moment your three itineraries are ready, usually within a few minutes."
          />
        )}
        {view.status === "expired" && (
          <StatePanel
            eyebrow="Hold released"
            title="These options have expired"
            body="Held itineraries are reserved for 15 minutes so providers can plan. This hold has passed, but starting again takes only a moment, and we’ll rebuild fresh options around the same preferences."
            cta={{ href: "/", label: "Start a new request" }}
          />
        )}
        {view.status === "not_found" && (
          <StatePanel
            eyebrow="Not found"
            title="We couldn’t find this itinerary"
            body="This link may be incomplete or no longer valid. Check the link in your email, or start a new request."
            cta={{ href: "/", label: "Start a new request" }}
          />
        )}
      </main>
    </>
  );
}

function StatePanel({
  eyebrow,
  title,
  body,
  cta,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <section className={styles.statePanel}>
      <span className={styles.stateEyebrow}>{eyebrow}</span>
      <h1 className={styles.stateTitle}>{title}</h1>
      <p className={styles.stateBody}>{body}</p>
      {cta && (
        <Link href={cta.href} className={styles.stateCta}>
          {cta.label}
        </Link>
      )}
    </section>
  );
}
