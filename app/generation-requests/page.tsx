import Link from "next/link";
import { requireAdmin } from "@/utils/auth";
import { fullName, one } from "@/utils/plans";

type Row = {
  id: number;
  created_at: string;
  neighborhood: string | null;
  inputs: { budget?: string; purpose?: string; categories?: string[] } | null;
  status: string;
  error: string | null;
  plan_id: number | null;
  duration_ms: number | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
  prompt_chains: { name: string } | null;
  llm_responses: { id: number }[];
};

const STATUSES = ["success", "failed"] as const;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

// Read only: every time someone asked OutNYC for a plan, and how it went
export default async function GenerationRequestsPage({ searchParams }: PageProps<"/generation-requests">) {
  const { supabase } = await requireAdmin();
  const { status } = await searchParams;
  const filter = STATUSES.find((s) => s === status);

  let query = supabase
    .from("generation_requests")
    .select(
      "id, created_at, neighborhood, inputs, status, error, plan_id, duration_ms, profiles(first_name, last_name), prompt_chains(name), llm_responses(id)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (filter) query = query.eq("status", filter);
  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const failed = rows.filter((row) => row.status === "failed").length;

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <p className="text-xs uppercase tracking-widest text-muted">Generation requests</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">
        {rows.length} {filter ?? ""} {rows.length === 1 ? "request" : "requests"}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Each time someone asks OutNYC for a plan, including the ones that fail. Newest first, up to 500. Not implemented yet.
        {!filter && rows.length > 0 && ` ${failed} failed.`}
      </p>

      <div className="mt-6 flex gap-2 text-sm">
        {[undefined, ...STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/generation-requests?status=${s}` : "/generation-requests"}
            className={`rounded-full border px-4 py-1.5 ${s === filter ? "border-ink bg-ink text-white" : "border-line-strong text-ink hover:bg-card"}`}
          >
            {s ? s[0].toUpperCase() + s.slice(1) : "All"}
          </Link>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-down">Couldn&apos;t load requests: {error.message}</p>}
      {!error && rows.length === 0 && <p className="mt-8 text-sm text-ink-soft">No requests yet.</p>}

      {rows.length > 0 && (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-widest text-muted">
              <tr>
                <th className="px-4 py-3 font-normal">ID</th>
                <th className="px-4 py-3 font-normal">When</th>
                <th className="px-4 py-3 font-normal">Who</th>
                <th className="px-4 py-3 font-normal">Asked for</th>
                <th className="px-4 py-3 font-normal">Chain</th>
                <th className="px-4 py-3 font-normal">Result</th>
                <th className="px-4 py-3 font-normal">Time</th>
                <th className="px-4 py-3 font-normal">LLM calls</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const inputs = row.inputs ?? {};
                return (
                  <tr key={row.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3 tabular-nums text-muted">{row.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-ink">{fullName(one(row.profiles))}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {[row.neighborhood, inputs.budget, inputs.purpose && `“${inputs.purpose}”`].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{one(row.prompt_chains)?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.status === "success" ? (
                        row.plan_id ? (
                          <Link href={`/plans/${row.plan_id}`} className="text-accent underline-offset-4 hover:underline">
                            Plan #{row.plan_id}
                          </Link>
                        ) : (
                          <span className="text-accent">Success</span>
                        )
                      ) : (
                        <span className="text-down">Failed{row.error && `: ${row.error}`}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-ink-soft">
                      {row.duration_ms != null ? `${(row.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.llm_responses.length > 0 ? (
                        <Link href={`/llm-responses?request=${row.id}`} className="text-accent underline-offset-4 hover:underline">
                          {row.llm_responses.length}
                        </Link>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
