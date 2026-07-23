"use client";
// Provider portal sidebar: the "Viewing as" demo switcher plus the section nav.
// The acting provider lives in the ?provider= query param, so switching it (or
// navigating between sections) preserves the selection.
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import styles from "./provider.module.css";

interface ProviderOption {
  id: string;
  name: string;
  zone_name: string;
}

const SECTIONS = [
  { href: "/provider", label: "Bookings", exact: true },
  { href: "/provider/services", label: "Services", exact: false },
  { href: "/provider/information", label: "Information", exact: false },
];

export default function ProviderSidebar({
  providers,
  defaultId,
}: {
  providers: ProviderOption[];
  defaultId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("provider") || defaultId;

  function withProvider(href: string, id: string) {
    return `${href}?provider=${encodeURIComponent(id)}`;
  }

  function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    // Keep the current section, just swap the acting provider.
    router.push(withProvider(pathname, e.target.value));
  }

  return (
    <>
      <nav className={styles.nav} aria-label="Provider sections">
        {SECTIONS.map((s) => {
          const active = s.exact ? pathname === s.href : pathname.startsWith(s.href);
          return (
            <Link
              key={s.href}
              href={withProvider(s.href, activeId)}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.actingAs}>
        <span className={styles.actingAsLabel}>Viewing as</span>
        <select
          className={styles.actingAsSelect}
          value={activeId}
          onChange={onSelect}
          aria-label="Select which provider you are viewing as"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.zone_name}
            </option>
          ))}
        </select>
        <p className={styles.actingAsNote}>
          Demo only: there is no provider login. Switch to any business to explore its portal.
        </p>
      </div>
    </>
  );
}
