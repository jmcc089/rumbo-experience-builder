import Header from "./components/Header";
import IntakeForm from "./components/IntakeForm";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div id="top">
      <Header />

      {/* ---- Hero -------------------------------------------------- */}
      {/* Intended background: a full-bleed El Salvador photograph.
          Placeholder for now: a cobalt→navy wash, clearly swappable. */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Boutique experiences · El Salvador</p>
          <h1 className={styles.heroTitle}>
            All of El Salvador,
            <br />
            none of the planning
          </h1>
          <p className={styles.heroSub}>
            Tell us how you picture your trip. We build every day of it — you just
            show up and live it.
          </p>
          <a href="#intake" className={styles.heroCta}>
            Start planning
          </a>
          <p className={styles.reassure}>
            No payment until you approve an itinerary.
          </p>
        </div>
        <a href="#intake" className={styles.scrollCue} aria-label="Start below">
          <span>Start below</span>
          <span className={styles.chev} aria-hidden>
            ↓
          </span>
        </a>
      </section>

      {/* ---- Intake ------------------------------------------------ */}
      <section id="intake" className={styles.intakeSection}>
        <div className={styles.intakeHead}>
          <h2 className={styles.intakeTitle}>Tell us about your trip</h2>
          <p className={styles.intakeLede}>
            Three short steps. The last one is where you tell us what really
            matters — we shape everything around it.
          </p>
        </div>
        <div className={styles.intakeWrap}>
          <IntakeForm />
        </div>
      </section>

      <footer className={styles.footer}>
        <span className="rumbo-logo">
          Rumbo<span className="dot">.</span>
        </span>
        <span className={styles.footNote}>
          A boutique inbound operator · San Salvador, El Salvador
        </span>
      </footer>
    </div>
  );
}
