import styles from "./Header.module.css";

/**
 * Client-portal header: cobalt band, all-white "Rumbo." wordmark (white dot),
 * and a single functional CTA. No login anywhere in Rumbo (portfolio scope —
 * documented in the README/SAD), so there is no sign-in.
 */
export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="#top" className={`rumbo-logo ${styles.logo}`} aria-label="Rumbo home">
          Rumbo<span className="dot">.</span>
        </a>
        <nav className={styles.nav} aria-label="Primary">
          <a href="#intake" className={styles.cta}>
            Start planning
          </a>
        </nav>
      </div>
    </header>
  );
}
