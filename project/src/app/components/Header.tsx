import styles from "./Header.module.css";

/**
 * Client-portal header: cobalt band, all-white "Rumbo." wordmark (gold dot),
 * minimal nav. Nav links are presentational (no login anywhere in Rumbo).
 */
export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="#top" className={`rumbo-logo ${styles.logo}`} aria-label="Rumbo home">
          Rumbo<span className="dot">.</span>
        </a>
        <nav className={styles.nav} aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#experiences">Experiences</a>
          <a href="#" className={styles.signin}>
            Sign in
          </a>
        </nav>
      </div>
    </header>
  );
}
