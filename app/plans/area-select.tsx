"use client";

// Area dropdown for the plans search form: picking an area applies it right away
export function AreaSelect({ areas, value }: { areas: [string, number][]; value: string }) {
  return (
    <span className="relative">
      <select
        name="area"
        defaultValue={value}
        aria-label="Area"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-full appearance-none rounded-full border border-line-strong bg-card py-2.5 pr-10 pl-4 text-sm text-ink focus:border-accent focus:outline-none"
      >
        <option value="">All areas</option>
        {areas.map(([name, count]) => (
          <option key={name} value={name}>
            {name} ({count})
          </option>
        ))}
      </select>
      {/* Our own arrow: the browser's sits too close to the edge */}
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted"
      >
        <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
