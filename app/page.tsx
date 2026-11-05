import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/utils/auth";
import { categoryLabel, fullName, parseContent } from "@/utils/plans";
import { GOOGLE, money } from "@/utils/pricing";
import { Avatar } from "./avatar";
import { BarList, Card, Empty, Split } from "./charts";
import { RangeFilter, inRange, readRange } from "./range-filter";

type Plan = {
  id: number;
  created_at: string;
  user_id: string;
  neighborhood: string | null;
  inputs: { budget?: string } | null;
  content: string | null;
};
// select("*"): created_at is used only if the votes table has it
type Vote = { user_id: string; plan_id: number; value: number; created_at?: string };
type Profile = { id: string; created_at: string; first_name: string | null; last_name: string | null; avatar_url: string | null };

// "2026-10-22" in New York time (OutNYC counts Google searches per NY day)
const nyDay = (date: Date | string) => new Date(date).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

function tally<T>(items: T[], key: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

// Top `n` of a tally, biggest first
function top(counts: Map<string, number>, n: number) {
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value }));
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

type StatProps = { label: string; value: ReactNode; note?: string; about: string; href?: string };

// A number tile: label, big value, the numbers behind it, and what it means
function Stat({ label, value, note, about, href }: StatProps) {
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
function About({ children }: { children: ReactNode }) {
  // mt-auto: sits at the bottom, so lines up across tiles of one row
  return (
    <div className="mt-auto pt-3">
      <p className="border-t border-line pt-2 text-[11px] leading-snug text-ink-soft">{children}</p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const { supabase } = await requireAdmin();
  const today = nyDay(new Date());
  const monthStart = `${today.slice(0, 8)}01`;
  const range = readRange(await searchParams, today);
  const allTime = range.value === "all";

  const [plansRes, votesRes, profilesRes, googleRes] = await Promise.all([
    supabase.from("plans").select("id, created_at, user_id, neighborhood, inputs, content"),
    supabase.from("votes").select("*"),
    supabase.from("profiles").select("id, created_at, first_name, last_name, avatar_url"),
    supabase.from("google_usage").select("day, requests").gte("day", monthStart),
  ]);
  const loadError = plansRes.error ?? votesRes.error ?? profilesRes.error ?? googleRes.error;

  const allPlans = ((plansRes.data ?? []) as Plan[]).map((row) => ({ ...row, plan: parseContent(row.content) }));
  const allVotes = (votesRes.data ?? []) as Vote[];
  const allProfiles = (profilesRes.data ?? []) as Profile[];
  const usage = (googleRes.data ?? []) as { day: string; requests: number }[];

  // --- The chosen period ---------------------------------------------------
  const votesHaveDates = allVotes.some((vote) => vote.created_at);
  const plans = allPlans.filter((row) => inRange(range, nyDay(row.created_at)));
  const newUsers = allProfiles.filter((row) => inRange(range, nyDay(row.created_at)));
  const votes = votesHaveDates ? allVotes.filter((vote) => vote.created_at && inRange(range, nyDay(vote.created_at))) : allVotes;
  const ups = votes.filter((vote) => vote.value === 1).length;

  // --- Engagement ----------------------------------------------------------
  const plansBy = tally(plans, (row) => row.user_id);
  const votesBy = tally(votes, (vote) => vote.user_id);
  // Made a plan or voted in this period (votes count only if they have dates)
  const activeIds = new Set([...plansBy.keys(), ...(votesHaveDates ? votesBy.keys() : [])]);

  // --- Money (Google bills per calendar month, so these ignore the filter) --
  const googleToday = usage.find((row) => row.day === today)?.requests ?? 0;
  const googleMonth = usage.reduce((sum, row) => sum + row.requests, 0);
  const googleBill = Math.max(0, googleMonth - GOOGLE.freePerMonth) * GOOGLE.perSearch;


  // --- Demand ----------------------------------------------------------------
  const stops = plans.flatMap((row) => row.plan?.stops ?? []);
  const neighborhoods = top(tally(plans, (row) => row.neighborhood?.trim()), 6);
  const categories = top(tally(stops, (stop) => categoryLabel(String(stop.category ?? ""))), 8);
  const budgets = tally(plans, (row) => row.inputs?.budget);

  // --- Best plans and people -------------------------------------------------
  const scores = new Map<number, { up: number; down: number }>();
  for (const vote of allVotes) {
    const score = scores.get(vote.plan_id) ?? { up: 0, down: 0 };
    if (vote.value === 1) score.up++;
    else score.down++;
    scores.set(vote.plan_id, score);
  }
  const net = (id: number) => (scores.get(id)?.up ?? 0) - (scores.get(id)?.down ?? 0);
  // Highest score first; ties go to the newer plan
  const topPlans = plans
    .filter((row) => row.plan && net(row.id) >= 1)
    .sort((a, b) => net(b.id) - net(a.id) || b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  const active = allProfiles
    .map((profile) => ({ profile, plans: plansBy.get(profile.id) ?? 0, votes: votesBy.get(profile.id) ?? 0 }))
    .filter((person) => person.plans + person.votes > 0)
    .sort((a, b) => b.plans + b.votes - (a.plans + a.votes))
    .slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <RangeFilter range={range} today={today} />
      {loadError && <p className="mt-3 text-sm text-down">Some data didn&apos;t load: {loadError.message}</p>}
      {!allTime && !votesHaveDates && (
        <p className="mt-3 text-xs text-muted">Votes have no date, so vote numbers are all-time.</p>
      )}

      {/* The 5 numbers that matter most: growth, usage, engagement, activation, quality */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Stat
          label={allTime ? "Users" : "New users"}
          value={newUsers.length}
          note={allTime ? undefined : `${allProfiles.length} in total`}
          about={allTime ? "Everyone who has signed up to OutNYC." : "People who signed up in this period."}
          href="/users"
        />
        <Stat label={allTime ? "Plans" : "New plans"} value={plans.length} note={allTime ? undefined : `${allPlans.length} in total`} about="Plans users made with the AI, plus any you made here." href="/plans" />
        <Stat
          label="Active users"
          value={pct(activeIds.size, allProfiles.length)}
          note={`${activeIds.size} of ${allProfiles.length} users`}
          about={
            votesHaveDates
              ? "Users who made a plan or voted in this period."
              : "Users who made a plan in this period (votes have no date)."
          }
        />
        <Stat
          label="Made a plan"
          value={pct(plansBy.size, allProfiles.length)}
          note={`${plansBy.size} of ${allProfiles.length} users`}
          about="Users who used the main feature in this period."
        />
        <Stat label="Approval rate" value={pct(ups, votes.length)} note={`👍 ${ups} · 👎 ${votes.length - ups}`} about="Share of votes that are 👍: do people like the plans?" href="/votes" />
      </div>

      {/* Cost and limit only; the bill by service, plans by model and estimates are on /costs */}
      <Section title="Costs &amp; limits" note="Always this month: Google’s free searches reset on the 1st.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat
            label="This month's bill"
            value={money(googleBill)}
            note={`${googleMonth} / ${GOOGLE.freePerMonth.toLocaleString()} free Google searches used`}
            about="What OutNYC really pays this month. Gemini is on the free tier ($0). Details on the Costs page."
            href="/costs"
          />
          <Stat
            label="Google searches today"
            value={`${googleToday} / ${GOOGLE.ourDailyCap}`}
            note={googleToday >= GOOGLE.ourDailyCap ? "Cap reached: no new plans until tomorrow" : "OutNYC's own daily cap"}
            about="Place searches used today. Each new plan needs at least one."
            href="/costs"
          />
        </div>
      </Section>

      <Section title="Demand">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card title="Top neighborhoods" note="Where people plan their outings most.">
            <BarList items={neighborhoods} unit="plans" />
          </Card>
          <Card title="Top categories" note="Kinds of places that end up in plans, counted per stop.">
            <BarList items={categories} unit="stops" />
          </Card>
          <Card title="Budget" note="Price level people chose when making a plan.">
            {/* Ordered light → dark green: more $ = darker */}
            <Split
              parts={[
                { label: "$", value: budgets.get("$") ?? 0, color: "#a9c7b8" },
                { label: "$$", value: budgets.get("$$") ?? 0, color: "#5f9a80" },
                { label: "$$$", value: budgets.get("$$$") ?? 0, color: "var(--color-accent)" },
              ]}
            />
          </Card>
        </div>
      </Section>

      <Section title="Best plans and people">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Top plans" note={`Best-liked plans${allTime ? "" : " made in this period"}. Score = 👍 minus 👎.`}>
            {topPlans.length ? (
              <ol className="flex flex-col gap-4">
                {topPlans.map((row) => (
                  <li key={row.id}>
                    <Link href={`/plans/${row.id}`} className="group flex items-baseline gap-4">
                      <span className="w-10 shrink-0 font-serif text-3xl text-accent tabular-nums">+{net(row.id)}</span>
                      <span className="min-w-0">
                        <span className="block font-serif text-lg leading-snug text-ink group-hover:underline">
                          {row.plan!.title}
                        </span>
                        <span className="block text-xs text-muted">
                          {row.neighborhood} · 👍 {scores.get(row.id)?.up ?? 0} · 👎 {scores.get(row.id)?.down ?? 0}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No plan has a positive score yet.</p>
            )}
          </Card>
          <Card title="Most active users" note="Your most engaged users, by plans made + votes given.">
            {active.length ? (
              <ol className="flex flex-col gap-3">
                {active.map(({ profile, plans: made, votes: given }, i) => (
                  <li key={profile.id} className="flex items-center gap-3 text-sm">
                    <span className="w-3 font-serif text-muted">{i + 1}</span>
                    <Avatar url={profile.avatar_url} name={fullName(profile)} size={32} />
                    <span className="min-w-0 flex-1 truncate text-ink">{fullName(profile)}</span>
                    <span className="text-xs whitespace-nowrap text-ink-soft tabular-nums">
                      {made} plans · {given} votes
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty />
            )}
          </Card>
        </div>
      </Section>
    </main>
  );
}
