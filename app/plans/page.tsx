import Link from "next/link";
import { requireAdmin } from "@/utils/auth";
import { formatDate, fullName, one, parseContent } from "@/utils/plans";

type Row = {
  id: number;
  created_at: string;
  neighborhood: string | null;
  content: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
  votes: { value: number }[];
};

export default async function PlansPage({ searchParams }: PageProps<"/plans">) {
  const { supabase } = await requireAdmin();
  const { q, deleted } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim();

  const { data, error } = await supabase
    .from("plans")
    .select("id, created_at, neighborhood, content, profiles(first_name, last_name), votes(value)")
    .order("created_at", { ascending: false });

  const plans = ((data ?? []) as unknown as Row[]).map((row) => {
    const plan = parseContent(row.content);
    const author = fullName(one(row.profiles));
    return {
      ...row,
      plan,
      author,
      up: row.votes.filter((vote) => vote.value === 1).length,
      down: row.votes.filter((vote) => vote.value === -1).length,
      // Everything the search looks at, lowercased
      haystack: [plan?.title, row.neighborhood, author, ...(plan?.stops.map((stop) => stop.name) ?? [])]
        .join(" ")
        .toLowerCase(),
    };
  });

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = plans.filter((plan) => words.every((word) => plan.haystack.includes(word)));

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Plans</p>
          <h1 className="mt-2 font-serif text-4xl text-ink">
            {query ? `${shown.length} of ${plans.length} plans` : `${plans.length} plans`}
          </h1>
        </div>
        <Link
          href="/plans/new"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          New plan
        </Link>
      </div>

      {deleted && <p className="mt-4 text-sm text-ink-soft">Plan deleted.</p>}

      {/* A plain GET form: the search lives in the URL (/plans?q=soho) */}
      <form autoComplete="off" data-form-type="other" className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search title, neighborhood, place or author"
          className="w-full max-w-md rounded-full border border-line-strong bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button className="rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink hover:bg-card">
          Search
        </button>
        {query && (
          <Link href="/plans" className="self-center px-2 text-sm text-muted hover:text-ink">
            Clear
          </Link>
        )}
      </form>

      {error && <p className="mt-6 text-sm text-ink-soft">Couldn&apos;t load plans: {error.message}</p>}
      {!error && shown.length === 0 && <p className="mt-8 text-sm text-ink-soft">No plans match.</p>}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {shown.map((row) => (
          <li key={row.id}>
            <Link
              href={`/plans/${row.id}`}
              className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-card p-5 transition hover:border-ink"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-serif text-xl leading-snug text-ink">
                  {row.plan?.title || <span className="text-muted">Untitled plan</span>}
                </h2>
                <span className="shrink-0 text-sm tabular-nums text-ink-soft">
                  👍 {row.up} · 👎 {row.down}
                </span>
              </div>
              <p className="text-xs text-muted">
                {[row.neighborhood, `by ${row.author}`, formatDate(row.created_at), row.plan && `${row.plan.stops.length} stops`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {row.plan ? (
                <p className="text-sm text-ink-soft">{row.plan.stops.map((stop) => stop.name).join(" → ")}</p>
              ) : (
                <p className="text-sm text-ink-soft">This plan&apos;s content can&apos;t be read. Open it to fix.</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
