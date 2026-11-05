import { requireAdmin } from "@/utils/auth";
import { GEMINI, GOOGLE, money } from "@/utils/pricing";
import { BarList, Card } from "../charts";
import { About, Section, Stat, nyDay, tally } from "../stats";

// Plans written in the admin (no AI, no cost)
const ADMIN_MODEL = "admin";

// Every model OutNYC can use (app/explore/gemini.ts), in its fallback order,
// so unused ones still show with 0
const MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-flash-lite-latest", ADMIN_MODEL];

// What OutNYC's outside services cost this month, and what they would cost if it grows
export default async function CostsPage() {
  const { supabase } = await requireAdmin();
  const today = nyDay(new Date());
  const monthStart = `${today.slice(0, 8)}01`;

  const [plansRes, googleRes, samplesRes] = await Promise.all([
    supabase.from("plans").select("created_at, model").gte("created_at", monthStart),
    supabase.from("google_usage").select("day, requests").gte("day", monthStart),
    // The latest AI plans, to estimate how big a Gemini request is
    supabase
      .from("plans")
      .select("prompt, content")
      .neq("model", ADMIN_MODEL)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const loadError = plansRes.error ?? googleRes.error ?? samplesRes.error;

  // The query compares UTC dates; keep only this month in New York time
  const monthPlans = ((plansRes.data ?? []) as { created_at: string; model: string | null }[]).filter(
    (row) => nyDay(row.created_at) >= monthStart,
  );
  const usage = (googleRes.data ?? []) as { day: string; requests: number }[];

  const googleToday = usage.find((row) => row.day === today)?.requests ?? 0;
  const googleMonth = usage.reduce((sum, row) => sum + row.requests, 0);
  const [year, month] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthCap = GOOGLE.ourDailyCap * daysInMonth;
  const googleBill = Math.max(0, googleMonth - GOOGLE.freePerMonth) * GOOGLE.perSearch;

  const aiPlansThisMonth = monthPlans.filter((row) => row.model !== ADMIN_MODEL).length;
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
  const modelCounts = tally(monthPlans, (row) => row.model ?? "unknown");
  const models = [...new Set([...MODELS, ...modelCounts.keys()])].map((model) => ({
    label: model === ADMIN_MODEL ? "No AI (made by admin)" : model,
    value: modelCounts.get(model) ?? 0,
  }));

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <p className="text-xs uppercase tracking-widest text-muted">Costs &amp; limits</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">What OutNYC costs to run</h1>
      {loadError && <p className="mt-3 text-sm text-down">Some data didn&apos;t load: {loadError.message}</p>}

  <Section title="This month" note="Google bills per calendar month, and its free searches reset on the 1st.">
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
      <Card title="Plans by AI model" note="Which AI model wrote each plan this month. OutNYC switches to the next model when one runs out of free requests.">
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
    </main>
  );
}
