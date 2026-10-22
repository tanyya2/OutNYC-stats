import Link from "next/link";
import { DateRangePicker } from "./date-range-picker";

// "" (no ?range) = this calendar month, the default: it matches how Google bills
export const PRESETS = [
  { value: "", label: "This month" },
  { value: "7", label: "Past week", days: 7 },
  { value: "14", label: "Past 2 weeks", days: 14 },
  { value: "all", label: "All time" },
];

export type Range = { value: string; from: string; to: string; label: string };

const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

function daysBefore(day: string, n: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

// Reads ?range=7|14|30|custom (&from=&to=) into an inclusive day span (New York days).
// "" from/to = no limit on that side.
export function readRange(params: Record<string, string | string[] | undefined>, today: string): Range {
  if (params.range === "custom" && (isDay(params.from) || isDay(params.to))) {
    let from = isDay(params.from) ? params.from : "";
    let to = isDay(params.to) ? params.to : "";
    if (from && to && from > to) [from, to] = [to, from];
    const label = `${from || "start"} → ${to || "today"}`;
    return { value: "custom", from, to, label };
  }
  const preset = PRESETS.find((p) => p.value === params.range) ?? PRESETS[0];
  if (preset.value === "all") return { value: "all", from: "", to: "", label: preset.label };
  const from = preset.days ? daysBefore(today, preset.days - 1) : `${today.slice(0, 8)}01`;
  return { value: preset.value, from, to: today, label: preset.label };
}

export function inRange(range: Range, day: string) {
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

// Pills for the presets, plus a dropdown calendar for custom dates. Lives in the URL (/?range=7).
export function RangeFilter({ range, today }: { range: Range; today: string }) {
  const pill = (active: boolean) =>
    `rounded-full border px-4 py-2 text-sm ${
      active ? "border-accent bg-accent text-white" : "border-line-strong text-ink hover:bg-card"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <Link key={preset.value} href={preset.value ? `/?range=${preset.value}` : "/"} className={pill(range.value === preset.value)}>
          {preset.label}
        </Link>
      ))}
      <DateRangePicker active={range.value === "custom"} from={range.from} to={range.to} today={today} />
    </div>
  );
}
