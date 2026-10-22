"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Days are "YYYY-MM-DD" strings (New York days), so plain string compare works.
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const show = (day: string, withYear = true) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear && { year: "numeric" }),
    timeZone: "UTC",
  });

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Props = { active: boolean; from: string; to: string; today: string };

// "Custom" pill that opens a month calendar: click a start day, then an end day, then Apply.
export function DateRangePicker({ active, from, to, today }: Props) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [hover, setHover] = useState("");
  const [view, setView] = useState({ y: 0, m: 0 });

  // Close on a click outside or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      // Start from the range in the URL, showing its last month (or this month)
      const shown = to || from || today;
      setStart(from);
      setEnd(to);
      setView({ y: Number(shown.slice(0, 4)), m: Number(shown.slice(5, 7)) - 1 });
    }
    setOpen(!open);
  }

  function pick(day: string) {
    if (!start || end) {
      setStart(day);
      setEnd("");
    } else if (day < start) {
      setEnd(start);
      setStart(day);
    } else {
      setEnd(day);
    }
  }

  function apply() {
    router.push(`/?range=custom&from=${start}&to=${end || start}`);
    setOpen(false);
  }

  const move = (delta: number) =>
    setView(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));

  // Range being shown: the picked one, or start → hovered day while choosing the end
  const lo = start && !end && hover ? (hover < start ? hover : start) : start;
  const hi = start && !end && hover ? (hover < start ? start : hover) : end;

  const firstWeekday = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const monthName = new Date(Date.UTC(view.y, view.m, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const atThisMonth = dayKey(view.y, view.m, 1) >= `${today.slice(0, 8)}01`;

  const label = active && from ? `${show(from, false)} – ${show(to || from)}` : "Custom";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`rounded-full border px-4 py-2 text-sm ${
          active ? "border-accent bg-accent text-white" : "border-line-strong text-ink hover:bg-card"
        }`}
      >
        <span className="flex items-center gap-1.5">
          {label}
          {/* Thin chevron; flips up while open */}
          <svg
            viewBox="0 0 12 12"
            aria-hidden
            className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 4.5 6 7.5 9 4.5" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-2xl border border-line bg-card p-4 shadow-[0_8px_24px_rgba(28,27,25,0.08)]">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="rounded-full px-2 py-1 text-ink-soft hover:bg-paper">
              ‹
            </button>
            <span className="font-serif text-lg text-ink">{monthName}</span>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={atThisMonth}
              aria-label="Next month"
              className="rounded-full px-2 py-1 text-ink-soft hover:bg-paper disabled:opacity-30"
            >
              ›
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 text-center text-xs text-muted">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="py-1">
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-sm" onMouseLeave={() => setHover("")}>
            {Array.from({ length: firstWeekday }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = dayKey(view.y, view.m, i + 1);
              const future = day > today;
              const edge = day === lo || day === hi;
              const between = lo && hi && day > lo && day < hi;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={future}
                  onClick={() => pick(day)}
                  onMouseEnter={() => setHover(day)}
                  aria-label={show(day)}
                  aria-pressed={edge}
                  className={`mx-auto flex size-9 items-center justify-center rounded-full tabular-nums ${
                    edge
                      ? "bg-accent text-white"
                      : between
                        ? "bg-accent/10 text-ink"
                        : future
                          ? "text-muted/40"
                          : `text-ink hover:bg-paper ${day === today ? "font-semibold underline decoration-accent underline-offset-4" : ""}`
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted">
            {!start ? "Pick a start day" : !end ? `${show(start)} → pick an end day` : `${show(start)} → ${show(end)}`}
          </p>
          <div className="mt-3 flex justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setStart("");
                setEnd("");
              }}
              className="px-2 text-sm text-muted hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!start}
              className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
