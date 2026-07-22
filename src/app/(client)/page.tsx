import Header from "./components/Header";
import IntakeForm from "./components/IntakeForm";
import styles from "./page.module.css";

// Full-bleed hero photography of El Salvador (public/). Different source
// sizes; the slideshow renders each with `cover`, so they all fill the hero.
const HERO_IMAGES = [
  { src: "/hero-1.jpg", alt: "Volcanic rock formations on the Pacific coast at sunset" },
  { src: "/hero-2.jpg", alt: "The turquoise crater lake of the Santa Ana volcano" },
  { src: "/hero-3.jpg", alt: "The Izalco volcano rising above forested highlands" },
  { src: "/hero-4.jpg", alt: "The Metropolitan Cathedral in San Salvador at golden hour" },
];

export default function Home() {
  return (
    <div id="top">
      <Header />

      {/* ---- Hero -------------------------------------------------- */}
      <section className={styles.hero} aria-label="El Salvador">
        <div className={styles.heroSlides} role="img" aria-label={HERO_IMAGES[0].alt}>
          {HERO_IMAGES.map((img, i) => (
            <div
              key={img.src}
              className={styles.heroSlide}
              style={{ backgroundImage: `url(${img.src})`, animationDelay: `${i * 8}s` }}
            />
          ))}
        </div>
        <div className={styles.heroOverlay} aria-hidden />
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Boutique experiences · El Salvador</p>
          <h1 className={styles.heroTitle}>
            All of El Salvador,
            <br />
            none of the planning
          </h1>
          <p className={styles.heroSub}>
            Tell us how you picture your trip. We build every day of it, so you
            just show up and live it.
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
            matters, and we shape everything around it.
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
