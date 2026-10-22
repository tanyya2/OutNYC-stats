// Plan shapes and helpers. OutNYC reads plans.content with JSON.parse and no
// safety net, so everything the admin saves must keep this exact shape.

// Same categories as OutNYC (app/explore/nyc.ts)
export const CATEGORIES = {
  coffee: "Coffee",
  restaurants: "Restaurants",
  bars: "Bars",
  clubs: "Clubs",
  museums: "Museums",
  parks: "Parks",
  bookstores: "Bookstores",
  dessert: "Dessert",
} as const;

export type Category = keyof typeof CATEGORIES;

export const BUDGETS = ["$", "$$", "$$$"] as const;

// OutNYC plans have 3–4 stops
export const STOPS = { min: 3, max: 4 };

// Older plans also have miles/address/rating… on a stop; edits keep those extras.
export type PlanStop = {
  placeId?: string;
  name: string;
  category: string;
  minutes: number;
  note: string;
  [extra: string]: unknown;
};

export type PlanContent = {
  title: string;
  stops: PlanStop[];
  tip: string;
};

// Reads plans.content without ever throwing; broken JSON → null
export function parseContent(content: string | null): PlanContent | null {
  try {
    const plan = JSON.parse(content ?? "");
    if (typeof plan?.title !== "string" || !Array.isArray(plan.stops)) return null;
    return {
      ...plan,
      tip: typeof plan.tip === "string" ? plan.tip : "",
      stops: plan.stops.filter((stop: unknown) => typeof stop === "object" && stop !== null),
    };
  } catch {
    return null;
  }
}

export function categoryLabel(category: string) {
  return CATEGORIES[category as Category] ?? category;
}

type Name = { first_name: string | null; last_name: string | null } | null | undefined;

// "Tetiana Tsarenko", or a fallback for profiles without a name yet
export function fullName(profile: Name) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "No name yet";
}

// The untyped client types a joined row as one object or a list
export function one<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

// 135 → "2 h 15 min"
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ") || "0 min";
}
