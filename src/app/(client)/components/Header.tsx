import styles from "./Header.module.css";

/**
 * Client-portal header: cobalt band, all-white "Rumbo." wordmark (white dot),
 * and a single functional CTA. No login anywhere in Rumbo (portfolio scope —
 * documented in the README/SAD), so there is no sign-in.
 *
 * `showCta` toggles the "Start planning" action: it belongs on the landing page
 * (scrolls to the intake), but not on token pages (proposals, status,
 * confirmation) where the visitor is already past intake.
 */
export default function Header({ showCta = true }: { showCta?: boolean }) {
  const home = showCta ? "#top" : "/";
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href={home} className={`rumbo-logo ${styles.logo}`} aria-label="Rumbo home">
          Rumbo<span className="dot">.</span>
        </a>
        {showCta && (
          <nav className={styles.nav} aria-label="Primary">
            <a href="#intake" className={styles.cta}>
              Start planning
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
