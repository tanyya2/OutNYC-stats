"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type NavLink = { href: string; label: string };

const links: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/plans", label: "Plans" },
  { href: "/votes", label: "Votes" },
];

// Too many pages for one row, so the rest sit in dropdowns
const groups: { label: string; links: NavLink[] }[] = [
  {
    label: "AI",
    links: [
      { href: "/prompt-chains", label: "Prompt chains" },
      { href: "/chain-mix", label: "Prompt chain mix" },
      { href: "/llm-models", label: "LLM models" },
      { href: "/llm-providers", label: "LLM providers" },
      { href: "/terms", label: "Terms" },
      { href: "/generation-examples", label: "Generation examples" },
    ],
  },
  {
    label: "Logs",
    links: [
      { href: "/generation-requests", label: "Generation requests" },
      { href: "/llm-responses", label: "LLM responses" },
    ],
  },
  {
    label: "Access",
    links: [
      { href: "/signup-domains", label: "Allowed sign-up domains" },
      { href: "/whitelisted-emails", label: "Whitelisted emails" },
    ],
  },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

const linkClass = (active: boolean) =>
  active ? "text-ink underline decoration-accent decoration-2 underline-offset-8" : "text-muted hover:text-ink";

// Runs in the browser so it knows which page is open and underlines it.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {links.map(({ href, label }) => (
        <Link key={href} href={href} className={linkClass(isActive(pathname, href))}>
          {label}
        </Link>
      ))}
      {groups.map((group) => (
        <Dropdown key={group.label} label={group.label} links={group.links} pathname={pathname} />
      ))}
    </nav>
  );
}

function Dropdown({ label, links, pathname }: { label: string; links: NavLink[]; pathname: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const active = links.some((link) => isActive(pathname, link.href));

  // Close after picking a page, and when clicking anywhere else
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.removeAttribute("open");
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary className={`cursor-pointer list-none ${linkClass(active)}`}>{label} ▾</summary>
      <div className="absolute left-0 z-20 mt-3 flex w-56 flex-col rounded-xl border border-line bg-card py-2 shadow-lg">
        {links.map(({ href, label: text }) => (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2 ${isActive(pathname, href) ? "bg-paper text-ink" : "text-ink-soft hover:bg-paper hover:text-ink"}`}
          >
            {text}
          </Link>
        ))}
      </div>
    </details>
  );
}
