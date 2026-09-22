"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: IconName;
  /** Extra path prefixes that should also light this item up. */
  also?: string[];
};

type IconName = "dashboard" | "groups" | "myGroup" | "evaluations" | "guidelines" | "admin";

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  groups: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.8 5.8 0 0 1 11 0" />
      <path d="M16.2 5.4a3.2 3.2 0 0 1 0 5.3" />
      <path d="M17.6 14.4a5.8 5.8 0 0 1 3 4" />
    </>
  ),
  myGroup: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 9.4-5.8" />
      <path d="m15.5 18.5 2 2 3.5-4" />
    </>
  ),
  evaluations: (
    <>
      <path d="M8 4h8a1 1 0 0 1 1 1v1H7V5a1 1 0 0 1 1-1z" />
      <path d="M17 6h1.5A1.5 1.5 0 0 1 20 7.5v11A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H7" />
      <path d="m8.8 13.4 2 2 4.4-4.8" />
    </>
  ),
  guidelines: (
    <>
      <path d="M6 3.5h7.5L19 9v11.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" />
      <path d="M13.5 3.5V9H19" />
      <path d="M8.5 13h7M8.5 16.5h5" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.5 5.5l-1.5 1.5M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5" />
    </>
  ),
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

function matches(pathname: string, path: string): number {
  if (pathname === path) return path.length + 1;
  if (path !== "/" && pathname.startsWith(`${path}/`)) return path.length;
  return 0;
}

/**
 * Longest match wins, so "My group" — which points straight at the student's
 * own group — beats the more general "Groups" on that one path, while another
 * group's page still lights up "Groups".
 */
function useIsActive(items: NavItem[]) {
  const pathname = usePathname();
  const score = (item: NavItem) =>
    Math.max(matches(pathname, item.href), ...(item.also ?? []).map((p) => matches(pathname, p)));
  const best = Math.max(0, ...items.map(score));
  const activeHref = best === 0 ? null : items.find((item) => score(item) === best)?.href ?? null;
  return (href: string) => href === activeHref;
}

/** The inline navigation shown in the header on wide screens. */
export function HeaderNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive(items);
  return (
    <nav className="nav" aria-label="Main">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={isActive(item.href) ? "active" : undefined}
          aria-current={isActive(item.href) ? "page" : undefined}
          // The short form: the header is capped at the content width, and the
          // full labels no longer fit beside a name this long. The full label
          // stays as the tooltip and in the footer.
          title={item.label}
        >
          {item.short}
        </Link>
      ))}
    </nav>
  );
}

/** A plain text row of the same links, always reachable in the footer. */
export function FooterNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="foot-nav" aria-label="Footer">
      {items.map((item) => (
        <Link key={item.href} href={item.href}>{item.label}</Link>
      ))}
    </nav>
  );
}

/** The thumb-reachable tab bar shown instead of the header nav on phones. */
export function TabBar({ items }: { items: NavItem[] }) {
  const isActive = useIsActive(items);
  return (
    <nav className="tabbar" aria-label="Main">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={isActive(item.href) ? "active" : undefined}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          <Icon name={item.icon} />
          <span>{item.short}</span>
        </Link>
      ))}
    </nav>
  );
}
