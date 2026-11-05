import Link from "next/link";
import type { ReactNode } from "react";

// Pieces shared by the dashboard and the costs page

// "2026-10-22" in New York time (OutNYC counts Google searches per NY day)
export const nyDay = (date: Date | string) => new Date(date).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export function tally<T>(items: T[], key: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

type StatProps = { label: string; value: ReactNode; note?: string; about: string; href?: string };

// A number tile: label, big value, the numbers behind it, and what it means
export function Stat({ label, value, note, about, href }: StatProps) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-serif text-4xl text-ink tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <About>{about}</About>
    </>
  );
  const box = "flex flex-col rounded-2xl border border-line bg-card p-5";
  return href ? (
    <Link href={href} className={`${box} hover:border-ink`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

// The short "what this shows" line at the bottom of a tile
export function About({ children }: { children: ReactNode }) {
  // mt-auto: sits at the bottom, so lines up across tiles of one row
  return (
    <div className="mt-auto pt-3">
      <p className="border-t border-line pt-2 text-[11px] leading-snug text-ink-soft">{children}</p>
    </div>
  );
}

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
