import Form from "next/form";
import Link from "next/link";
import { requireAdmin } from "@/utils/auth";
import { fullName, one, parseContent } from "@/utils/plans";
import { AreaSelect } from "../plans/area-select";
import { Stat } from "../stats";

type Vote = { plan_id: number; value: number };
type Plan = {
  id: number;
  neighborhood: string | null;
  content: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
};
type Row = { plan: Plan; title: string; up: number; down: number; score: number };

// Votes per plan: which plans people like, which they don't, and where
export default async function VotesPage({ searchParams }: PageProps<"/votes">) {
  const { supabase } = await requireAdmin();
  const { area } = await searchParams;
  const areaPick = typeof area === "string" ? area : "";

  const [votesRes, plansRes] = await Promise.all([
    supabase.from("votes").select("plan_id, value"),
    supabase.from("plans").select("id, neighborhood, content, profiles(first_name, last_name)"),
  ]);
  const loadError = votesRes.error ?? plansRes.error;

  // One row per plan that has votes
  const plans = new Map(((plansRes.data ?? []) as unknown as Plan[]).map((plan) => [plan.id, plan]));
  const counts = new Map<number, { up: number; down: number }>();
  for (const vote of (votesRes.data ?? []) as Vote[]) {
    const count = counts.get(vote.plan_id) ?? { up: 0, down: 0 };
    if (vote.value === 1) count.up++;
    else if (vote.value === -1) count.down++;
    counts.set(vote.plan_id, count);
  }
  const rows: Row[] = [...counts]
    .filter(([id]) => plans.has(id))
    .map(([id, { up, down }]) => {
      const plan = plans.get(id)!;
      return { plan, title: parseContent(plan.content)?.title || "Untitled plan", up, down, score: up - down };
    })
    // Best first; on a tie, the one more people voted on
    .sort((a, b) => b.score - a.score || b.up + b.down - (a.up + a.down));

  const areaCounts = new Map<string, number>();
  for (const row of rows) {
    const name = row.plan.neighborhood;
    if (name) areaCounts.set(name, (areaCounts.get(name) ?? 0) + 1);
  }
  const areas = [...areaCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = areaPick ? rows.filter((row) => row.plan.neighborhood === areaPick) : rows;

  // The summary follows the area filter
  const ups = shown.reduce((total, row) => total + row.up, 0);
  const downs = shown.reduce((total, row) => total + row.down, 0);
  const approval = ups + downs ? `${Math.round((ups / (ups + downs)) * 100)}%` : "—";
  const negative = shown.filter((row) => row.score < 0).length;
  const planCount = areaPick ? [...plans.values()].filter((plan) => plan.neighborhood === areaPick).length : plans.size;

  const summary = [
    { label: "Approval rate", value: approval, note: `👍 ${ups} · 👎 ${downs}`, about: "Share of votes that are 👍: do people like the plans?" },
    { label: "Plans with votes", value: shown.length, note: `of ${planCount} plans`, about: "How many plans someone rated." },
    { label: "Disliked plans", value: negative, note: "score below 0", about: "Plans with more 👎 than 👍: look at these to fix the prompt." },
  ];

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <p className="text-xs uppercase tracking-widest text-muted">Votes</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">
        Votes by plan{areaPick && <span className="text-ink-soft"> in {areaPick}</span>}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Which plans people like and which they don&apos;t. Best at the top, worst at the bottom. Score = 👍 minus 👎.
      </p>

      {/* A GET form (client-side navigation, no full reload): the area lives in the URL (/votes?area=…) */}
      <Form action="/votes" autoComplete="off" data-form-type="other" className="mt-6 flex flex-wrap gap-2">
        <AreaSelect areas={areas} value={areaPick} />
        {areaPick && (
          <Link href="/votes" className="self-center px-2 text-sm text-muted hover:text-ink">
            Clear
          </Link>
        )}
      </Form>

      {loadError ? (
        <p className="mt-6 text-sm text-ink-soft">Couldn&apos;t load votes: {loadError.message}</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {summary.map((stat) => (
              <Stat key={stat.label} {...stat} />
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="mt-8 text-sm text-ink-soft">No plan has votes yet.</p>
          ) : (
            <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-card">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-widest text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-5 py-3 font-medium">Area</th>
                    <th className="px-5 py-3 font-medium">Made by</th>
                    <th className="px-5 py-3 text-right font-medium">👍</th>
                    <th className="px-5 py-3 text-right font-medium">👎</th>
                    <th className="px-5 py-3 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.plan.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">
                        {/* The plan page lists who voted */}
                        <Link href={`/plans/${row.plan.id}`} className="text-ink hover:underline">
                          {row.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{row.plan.neighborhood || "—"}</td>
                      <td className="px-5 py-3 text-ink-soft">{fullName(one(row.plan.profiles))}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink">{row.up}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink">{row.down}</td>
                      <td
                        className={`px-5 py-3 text-right font-medium tabular-nums ${row.score > 0 ? "text-accent" : row.score < 0 ? "text-down" : "text-muted"}`}
                      >
                        {row.score > 0 ? `+${row.score}` : row.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
