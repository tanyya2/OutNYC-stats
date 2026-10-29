import Link from "next/link";
import { requireAdmin } from "@/utils/auth";
import { formatDate, fullName, parseContent } from "@/utils/plans";

// select("*"): shows "when" if the votes table has a created_at column
type Vote = { user_id: string; plan_id: number; value: number; created_at?: string };
type Profile = { id: string; first_name: string | null; last_name: string | null };
type Plan = { id: number; content: string | null };

export default async function VotesPage({ searchParams }: PageProps<"/votes">) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const pick = (name: string) => (typeof params[name] === "string" ? (params[name] as string) : "");
  const filter = { value: pick("value"), user: pick("user"), plan: pick("plan") };

  const [votesRes, profilesRes, plansRes] = await Promise.all([
    supabase.from("votes").select("*"),
    supabase.from("profiles").select("id, first_name, last_name"),
    supabase.from("plans").select("id, content"),
  ]);

  const votes = (votesRes.data ?? []) as Vote[];
  const names = new Map(((profilesRes.data ?? []) as Profile[]).map((p) => [p.id, fullName(p)]));
  const titles = new Map(
    ((plansRes.data ?? []) as Plan[]).map((p) => [p.id, parseContent(p.content)?.title || "Untitled plan"]),
  );
  const nameOf = (id: string) => names.get(id) ?? "Unknown user";
  const titleOf = (id: number) => titles.get(id) ?? `Plan #${id}`;

  // Newest first when we know "when", otherwise newest plans first
  const sorted = [...votes].sort((a, b) =>
    a.created_at && b.created_at ? b.created_at.localeCompare(a.created_at) : b.plan_id - a.plan_id,
  );
  const shown = sorted.filter(
    (vote) =>
      (filter.value === "" || String(vote.value) === filter.value) &&
      (filter.user === "" || vote.user_id === filter.user) &&
      (filter.plan === "" || String(vote.plan_id) === filter.plan),
  );
  const up = shown.filter((vote) => vote.value === 1).length;
  const hasWhen = votes.some((vote) => vote.created_at);

  // Dropdown choices: only people and plans that have votes
  const voters = [...new Set(votes.map((vote) => vote.user_id))].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const votedPlans = [...new Set(votes.map((vote) => vote.plan_id))].sort((a, b) => b - a);
  const filtered = filter.value || filter.user || filter.plan;

  const select =
    "rounded-full border border-line-strong bg-card px-4 py-2.5 text-sm text-ink focus:border-accent focus:outline-none";

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <p className="text-xs uppercase tracking-widest text-muted">Votes</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">
        {filtered ? `${shown.length} of ${votes.length} votes` : `${votes.length} votes`}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        👍 {up} · 👎 {shown.length - up}
      </p>

      {/* A plain GET form: filters live in the URL (/votes?value=-1) */}
      <form autoComplete="off" data-form-type="other" className="mt-6 flex flex-wrap gap-2">
        <select name="value" defaultValue={filter.value} aria-label="Vote" className={select}>
          <option value="">👍 and 👎</option>
          <option value="1">Only 👍</option>
          <option value="-1">Only 👎</option>
        </select>
        <select name="user" defaultValue={filter.user} aria-label="Who" className={`${select} max-w-60`}>
          <option value="">Everyone</option>
          {voters.map((id) => (
            <option key={id} value={id}>
              {nameOf(id)}
            </option>
          ))}
        </select>
        <select name="plan" defaultValue={filter.plan} aria-label="Plan" className={`${select} max-w-72`}>
          <option value="">All plans</option>
          {votedPlans.map((id) => (
            <option key={id} value={id}>
              {titleOf(id)}
            </option>
          ))}
        </select>
        <button className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90">
          Filter
        </button>
        {filtered && (
          <Link href="/votes" className="self-center px-2 text-sm text-muted hover:text-ink">
            Clear
          </Link>
        )}
      </form>

      {votesRes.error ? (
        <p className="mt-6 text-sm text-ink-soft">Couldn&apos;t load votes: {votesRes.error.message}</p>
      ) : shown.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No votes match.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-widest text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Vote</th>
                <th className="px-5 py-3 font-medium">Who</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                {hasWhen && <th className="px-5 py-3 font-medium">When</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((vote) => (
                <tr key={`${vote.user_id}:${vote.plan_id}`} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <span className={vote.value === 1 ? "text-accent" : "text-down"}>
                      {vote.value === 1 ? "👍 Up" : "👎 Down"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/votes?user=${vote.user_id}`} className="text-ink hover:underline">
                      {nameOf(vote.user_id)}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/plans/${vote.plan_id}`} className="text-ink hover:underline">
                      {titleOf(vote.plan_id)}
                    </Link>
                  </td>
                  {hasWhen && (
                    <td className="px-5 py-3 text-ink-soft">{vote.created_at ? formatDate(vote.created_at) : "—"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
