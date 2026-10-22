import type { ReactNode } from "react";

// Small chart pieces for the dashboard, plain HTML + Tailwind (no chart library).
// Hovering any bar shows its exact value.

export function Card({ title, note, children, className = "" }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-2xl border border-line bg-card p-5 ${className}`}>
      <h2 className="text-xs uppercase tracking-widest text-muted">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

export function Empty() {
  return <p className="text-sm text-muted">No data yet.</p>;
}

// Hover label above a mark
function Tip({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-card group-hover:block">
      {children}
    </span>
  );
}

// Ranked list with a thin bar under each label: "Hell's Kitchen ······ 12"
export function BarList({ items, unit }: { items: { label: string; value: number }[]; unit: string }) {
  if (items.length === 0) return <Empty />;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.label} className="group relative">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{item.label}</span>
            <span className="tabular-nums text-ink-soft">{item.value}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-paper">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <Tip>
            {item.label}: {item.value} {unit}
          </Tip>
        </li>
      ))}
    </ol>
  );
}

// One bar split into parts, each labeled with its share
export function Split({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total === 0) return <Empty />;
  const pct = (value: number) => Math.round((value / total) * 100);
  return (
    <div>
      <div className="flex h-3 gap-0.5">
        {parts
          .filter((part) => part.value > 0)
          .map((part) => (
            <div
              key={part.label}
              className="group relative h-full first:rounded-l-[4px] last:rounded-r-[4px]"
              style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
            >
              <Tip>
                {part.label}: {part.value} ({pct(part.value)}%)
              </Tip>
            </div>
          ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full" style={{ background: part.color }} />
            <span className="text-ink">{part.label}</span>
            <span className="tabular-nums text-ink-soft">
              {pct(part.value)}% · {part.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
