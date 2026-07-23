"use client";
// Sidebar navigation for the operator portal. Client component so it can mark
// the active route via usePathname.
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./operator.module.css";

const LINKS = [
  { href: "/operator", label: "Dashboard", exact: true },
  { href: "/operator/customers", label: "Customers", exact: false },
  { href: "/operator/providers", label: "Providers", exact: false },
];

export default function OperatorNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Operator sections">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
