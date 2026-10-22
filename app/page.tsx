import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/utils/auth";
import { categoryLabel, fullName, parseContent } from "@/utils/plans";
import { GEMINI, GOOGLE, money } from "@/utils/pricing";
import { Avatar } from "./avatar";
import { BarList, Card, Empty, Split } from "./charts";
import { RangeFilter, inRange, readRange } from "./range-filter";

type Plan = {
  id: number;
  created_at: string;
  user_id: string;
  neighborhood: string | null;
  inputs: { budget?: string } | null;
  model: string | null;
  content: string | null;
};
// select("*"): created_at is used only if the votes table has it
type Vote = { user_id: string; plan_id: number; value: number; created_at?: string };
type Profile = { id: string; created_at: string; first_name: string | null; last_name: string | null; avatar_url: string | null };

// Plans written in the admin (no AI, no cost)
const ADMIN_MODEL = "admin";

// Every model OutNYC can use (app/explore/gemini.ts), in its fallback order,
// so unused ones still show with 0
const MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-flash-lite-latest", ADMIN_MODEL];

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
  const thisMonth = range.value === "";

  const [plansRes, votesRes, profilesRes, googleRes, samplesRes] = await Promise.all([
    supabase.from("plans").select("id, created_at, user_id, neighborhood, inputs, model, content"),
    supabase.from("votes").select("*"),
    supabase.from("profiles").select("id, created_at, first_name, last_name, avatar_url"),
    supabase.from("google_usage").select("day, requests").gte("day", monthStart),
    // The latest AI plans, to estimate how big a Gemini request is
    supabase
      .from("plans")
      .select("prompt, content")
      .neq("model", ADMIN_MODEL)
      .order("created_at", { ascending: false })
      .limit(50),
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
  // All time: never made a plan or voted
  const everActive = new Set([...allPlans.map((row) => row.user_id), ...allVotes.map((vote) => vote.user_id)]);
  const neverActive = allProfiles.filter((profile) => !everActive.has(profile.id)).length;
  // All time: first name, last name and a photo
  const completed = allProfiles.filter((profile) => profile.first_name && profile.last_name && profile.avatar_url).length;

  // --- Money (Google bills per calendar month, so these ignore the filter) --
  const googleToday = usage.find((row) => row.day === today)?.requests ?? 0;
  const googleMonth = usage.reduce((sum, row) => sum + row.requests, 0);
  const [year, month] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthCap = GOOGLE.ourDailyCap * daysInMonth;
  const googleBill = Math.max(0, googleMonth - GOOGLE.freePerMonth) * GOOGLE.perSearch;

  const aiPlansThisMonth = allPlans.filter((row) => row.model !== ADMIN_MODEL && nyDay(row.created_at) >= monthStart).length;
  const searchesPerPlan = aiPlansThisMonth ? googleMonth / aiPlansThisMonth : 1;

  const samples = (samplesRes.data ?? []) as { prompt: string | null; content: string | null }[];
  const avgChars = (pick: (row: (typeof samples)[number]) => string | null) =>
    samples.length ? samples.reduce((sum, row) => sum + (pick(row)?.length ?? 0), 0) / samples.length : 0;
  const tokensIn = avgChars((row) => row.prompt) / GEMINI.charsPerToken;
  const tokensOut = avgChars((row) => row.content) / GEMINI.charsPerToken;
  const geminiPerPlan = tokensIn * GEMINI.perInputToken + tokensOut * GEMINI.perOutputToken;
  const googlePerPlan = searchesPerPlan * GOOGLE.perSearch;

  // "If OutNYC grows": a month with n AI plans, at this month's searches per plan
  const growth = [100, 1000, 10000].map((n) => {
    const searches = n * searchesPerPlan;
    const google = Math.max(0, searches - GOOGLE.freePerMonth) * GOOGLE.perSearch;
    const gemini = n * geminiPerPlan;
    return { n, searches, google, gemini };
  });

  // Days this month the daily cap stopped new plans
  const capHitDays = usage.filter((row) => row.requests >= GOOGLE.ourDailyCap).length;
  const dayOfMonth = Number(today.slice(8, 10));

  // Known models first (0 if unused), then anything else that shows up
  const modelCounts = tally(plans, (row) => row.model ?? "unknown");
  const models = [...new Set([...MODELS, ...modelCounts.keys()])].map((model) => ({
    label: model === ADMIN_MODEL ? "No AI (made by admin)" : model,
    value: modelCounts.get(model) ?? 0,
  }));

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
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <RangeFilter range={range} today={today} />
      {loadError && <p className="mt-3 text-sm text-down">Some data didn&apos;t load: {loadError.message}</p>}
      {!allTime && !votesHaveDates && (
        <p className="mt-3 text-xs text-muted">Votes have no date, so vote numbers are all-time.</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label={allTime ? "Users" : "New users"}
          value={newUsers.length}
          note={allTime ? undefined : `${allProfiles.length} in total`}
          about={allTime ? "Everyone who has signed up to OutNYC." : "People who signed up in this period."}
          href="/users"
        />
        <Stat label={allTime ? "Plans" : "New plans"} value={plans.length} note={allTime ? undefined : `${allPlans.length} in total`} about="Plans users made with the AI, plus any you made here." href="/plans" />
        <Stat label="Votes" value={votes.length} note={`${(votes.length / Math.max(plans.length, 1)).toFixed(1)} per plan`} about="👍 and 👎 people gave on plans." href="/votes" />
        <Stat label="Approval rate" value={pct(ups, votes.length)} note={`👍 ${ups} · 👎 ${votes.length - ups}`} about="Share of votes that are 👍: do people like the plans?" />
      </div>

      <Section title="Engagement">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
          <Stat
            label="Voted"
            value={pct(votesBy.size, allProfiles.length)}
            note={`${votesBy.size} of ${allProfiles.length} users`}
            about="Users who voted on at least one plan."
          />
          <Stat
            label="Never active"
            value={pct(neverActive, allProfiles.length)}
            note={`${neverActive} of ${allProfiles.length} users · all time`}
            about="Signed up but never made a plan or voted."
          />
          <Stat
            label="Profile completed"
            value={pct(completed, allProfiles.length)}
            note={`${completed} of ${allProfiles.length} users · all time`}
            about="Users with a first name, last name and photo."
          />
        </div>
      </Section>

      <Section title="Costs &amp; limits" note={thisMonth ? undefined : "Always this month: Google’s free searches reset on the 1st."}>
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-line bg-card p-5 lg:col-span-2">
            <p className="text-xs uppercase tracking-widest text-muted">This month&apos;s bill</p>
            <p className="mt-2 font-serif text-5xl text-ink tabular-nums">{money(googleBill)}</p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs uppercase tracking-widest text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-4 font-medium">Service</th>
                    <th className="py-2 pr-4 font-medium">Free plan</th>
                    <th className="py-2 pr-4 text-right font-medium">Used</th>
                    <th className="py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line">
                    <td className="py-3 pr-4">
                      <p className="text-ink">Google Places</p>
                      <p className="text-xs text-muted">Finds the real places in each plan</p>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{GOOGLE.freePerMonth.toLocaleString()} searches a month</td>
                    <td className="py-3 pr-4 text-right text-ink tabular-nums">
                      {googleMonth} / {GOOGLE.freePerMonth.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-ink tabular-nums">{money(googleBill)}</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-3 pr-4">
                      <p className="text-ink">Gemini</p>
                      <p className="text-xs text-muted">Writes the plans</p>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">Free tier, resets daily</td>
                    <td className="py-3 pr-4 text-right text-ink tabular-nums">{aiPlansThisMonth} plans</td>
                    <td className="py-3 text-right text-ink tabular-nums">{money(0)}</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-3 pr-4">
                      <p className="text-ink">OpenStreetMap</p>
                      <p className="text-xs text-muted">Finds addresses people type</p>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">Always free</td>
                    <td className="py-3 pr-4 text-right text-muted">—</td>
                    <td className="py-3 text-right text-ink tabular-nums">{money(0)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="pt-3 pr-4 font-medium text-ink">
                      Total
                    </td>
                    <td className="pt-3 text-right font-medium text-ink tabular-nums">{money(googleBill)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {monthCap <= GOOGLE.freePerMonth && (
              <p className="mt-4 text-xs text-muted">
                OutNYC&apos;s cap of {GOOGLE.ourDailyCap} searches a day allows at most {monthCap} this month, so Google stays free.
              </p>
            )}
          </section>
          <Card title="Plans by AI model" note="Which AI model wrote each plan. OutNYC switches to the next model when one runs out of free requests.">
            <BarList items={models} unit="plans" />
          </Card>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col rounded-2xl border border-line bg-card p-5">
            <p className="text-xs uppercase tracking-widest text-muted">Google searches today</p>
            <p className="mt-2 font-serif text-4xl text-ink tabular-nums">
              {googleToday}
              <span className="text-xl text-muted"> / {GOOGLE.ourDailyCap}</span>
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-paper">
              <div
                className={`h-full rounded-full ${googleToday >= GOOGLE.ourDailyCap ? "bg-down" : "bg-accent"}`}
                style={{ width: `${Math.min(100, (googleToday / GOOGLE.ourDailyCap) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {googleToday >= GOOGLE.ourDailyCap ? "Cap reached: no new plans until tomorrow" : "OutNYC's own daily cap"}
            </p>
            <About>Place searches used today. Each new plan needs at least one.</About>
          </div>
          <Stat
            label="Cap hit this month"
            value={`${capHitDays} ${capHitDays === 1 ? "day" : "days"}`}
            note={`out of ${dayOfMonth} so far`}
            about="Days users couldn't make plans because the daily cap ran out."
          />
          <Stat
            label="Cost per plan"
            value={money(googlePerPlan + geminiPerPlan)}
            note={`Google ${money(googlePerPlan)} + Gemini ${money(geminiPerPlan)}`}
            about="What one plan would cost with no free searches and Gemini's paid tier."
          />
        </div>

        <section className="mt-4 rounded-2xl border border-line bg-card p-5">
          <h3 className="text-xs uppercase tracking-widest text-muted">If OutNYC grows</h3>
          <p className="mt-1 text-xs text-muted">Estimated monthly bill, at this month&apos;s {searchesPerPlan.toFixed(1)} Google searches per plan.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 text-left font-medium">Plans a month</th>
                  <th className="py-2 pr-4 text-right font-medium">Google searches</th>
                  <th className="py-2 pr-4 text-right font-medium">Google cost</th>
                  <th className="py-2 pr-4 text-right font-medium">Gemini (paid tier)</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {growth.map((row) => (
                  <tr key={row.n} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4 text-ink">{row.n.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right text-ink-soft">~{Math.round(row.searches).toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right text-ink-soft">{money(row.google)}</td>
                    <td className="py-3 pr-4 text-right text-ink-soft">{money(row.gemini)}</td>
                    <td className="py-3 text-right font-medium text-ink">{money(row.google + row.gemini)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-snug text-ink-soft">
            The first {GOOGLE.freePerMonth.toLocaleString()} Google searches each month are free. Gemini may stay free while daily use
            fits its free limits. More than ~{monthCap} plans a month needs a daily cap above {GOOGLE.ourDailyCap}.
          </p>
        </section>

        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          Prices (checked October 2026, in utils/pricing.ts): Google Places Nearby Search Enterprise, {money(GOOGLE.perSearch)} per
          search after {GOOGLE.freePerMonth.toLocaleString()} free a month; today a plan uses {searchesPerPlan.toFixed(1)} searches on
          average. Gemini 2.5 Flash paid tier, $0.30 / $2.50 per million tokens in / out; a plan is about{" "}
          {Math.round(tokensIn).toLocaleString()} tokens in and {Math.round(tokensOut).toLocaleString()} out (average of the last{" "}
          {samples.length} AI plans). Google usage is exact; Gemini tokens are estimated from text length.
        </p>
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
