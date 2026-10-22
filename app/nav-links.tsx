"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/plans", label: "Plans" },
  { href: "/votes", label: "Votes" },
];

// Runs in the browser so it knows which page is open and underlines it.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-5 text-sm">
      {links.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? "text-ink underline decoration-accent decoration-2 underline-offset-8"
                : "text-muted hover:text-ink"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
