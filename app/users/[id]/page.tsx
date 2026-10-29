import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { formatDate, fullName, parseContent } from "@/utils/plans";
import { Avatar } from "../../avatar";

type Profile = {
  id: string;
  created_at: string;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_superadmin: boolean;
};
type Plan = { id: number; created_at: string; neighborhood: string | null; content: string | null; votes: { value: number }[] };
// select("*"): created_at is shown only if the votes table has it
type Vote = { plan_id: number; value: number; created_at?: string };

// One user, read only: profile, the plans they made and the votes they gave
export default async function UserPage({ params }: PageProps<"/users/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [profileRes, plansRes, votesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, created_at, updated_at, first_name, last_name, avatar_url, bio, is_superadmin")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("plans")
      .select("id, created_at, neighborhood, content, votes(value)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("votes").select("*").eq("user_id", id),
  ]);
  if (!profileRes.data) notFound();

  const profile = profileRes.data as Profile;
  const plans = (plansRes.data ?? []) as Plan[];
  const votes = ((votesRes.data ?? []) as Vote[]).sort((a, b) =>
    a.created_at && b.created_at ? b.created_at.localeCompare(a.created_at) : b.plan_id - a.plan_id,
  );
  const name = fullName(profile);

  // Titles of the plans they voted on
  const votedIds = votes.map((vote) => vote.plan_id);
  const { data: votedPlans } = votedIds.length
    ? await supabase.from("plans").select("id, content").in("id", votedIds)
    : { data: [] };
  const titles = new Map(
    ((votedPlans ?? []) as { id: number; content: string | null }[]).map((p) => [p.id, parseContent(p.content)?.title]),
  );
  const ups = votes.filter((vote) => vote.value === 1).length;

  const facts = [
    { label: "Joined", value: formatDate(profile.created_at) },
    { label: "Profile updated", value: profile.updated_at ? formatDate(profile.updated_at) : "—" },
    { label: "Plans made", value: String(plans.length) },
    { label: "Votes given", value: votes.length ? `👍 ${ups} · 👎 ${votes.length - ups}` : "0" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6">
      <Link href="/users" className="text-sm text-muted hover:text-ink">
        ← All users
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <Avatar url={profile.avatar_url} name={name} size={64} />
        <div>
          <h1 className="font-serif text-4xl leading-tight text-ink">{name}</h1>
          {profile.is_superadmin && (
            <span className="mt-1 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs text-white">Admin</span>
          )}
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-xs uppercase tracking-widest text-muted">Bio</h2>
        <p className="mt-2 text-sm whitespace-pre-line text-ink-soft">{profile.bio?.trim() || "No bio yet."}</p>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="bg-card p-4">
            <dt className="text-xs uppercase tracking-widest text-muted">{fact.label}</dt>
            <dd className="mt-1 font-serif text-xl text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 font-serif text-2xl text-ink">Plans</h2>
      {plans.length ? (
        <ul className="mt-3 flex flex-col divide-y divide-line rounded-2xl border border-line bg-card">
          {plans.map((plan) => {
            const up = plan.votes.filter((vote) => vote.value === 1).length;
            return (
              <li key={plan.id}>
                <Link href={`/plans/${plan.id}`} className="flex items-baseline justify-between gap-4 px-5 py-3 hover:bg-paper">
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{parseContent(plan.content)?.title || "Untitled plan"}</span>
                    <span className="block text-xs text-muted">
                      {[plan.neighborhood, formatDate(plan.created_at)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-ink-soft tabular-nums">
                    👍 {up} · 👎 {plan.votes.length - up}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No plans yet.</p>
      )}

      <h2 className="mt-10 font-serif text-2xl text-ink">Votes</h2>
      {votes.length ? (
        <ul className="mt-3 flex flex-col divide-y divide-line rounded-2xl border border-line bg-card">
          {votes.map((vote) => (
            <li key={vote.plan_id}>
              <Link href={`/plans/${vote.plan_id}`} className="flex items-baseline justify-between gap-4 px-5 py-3 hover:bg-paper">
                <span className="min-w-0 truncate text-ink">{titles.get(vote.plan_id) || `Plan #${vote.plan_id}`}</span>
                <span className="shrink-0 text-sm">
                  <span className={vote.value === 1 ? "text-accent" : "text-down"}>{vote.value === 1 ? "👍 Up" : "👎 Down"}</span>
                  {vote.created_at && <span className="ml-3 text-muted">{formatDate(vote.created_at)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No votes yet.</p>
      )}
    </main>
  );
}
