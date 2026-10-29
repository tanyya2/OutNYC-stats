import Link from "next/link";
import { requireAdmin } from "@/utils/auth";

type Row = {
  id: number;
  created_at: string;
  request_id: number | null;
  model: string;
  ok: boolean;
  http_status: number | null;
  response_text: string | null;
  duration_ms: number | null;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

// Read only: what each model sent back, how long it took, and whether it worked
export default async function LlmResponsesPage({ searchParams }: PageProps<"/llm-responses">) {
  const { supabase } = await requireAdmin();
  const { request, model, result } = await searchParams;
  const requestId = typeof request === "string" && /^\d+$/.test(request) ? Number(request) : null;
  const modelName = typeof model === "string" && model ? model : null;
  const okFilter = result === "ok" ? true : result === "failed" ? false : null;

  let query = supabase
    .from("llm_responses")
    .select("id, created_at, request_id, model, ok, http_status, response_text, duration_ms")
    .order("created_at", { ascending: false })
    .limit(500);
  if (requestId) query = query.eq("request_id", requestId);
  if (modelName) query = query.eq("model", modelName);
  if (okFilter !== null) query = query.eq("ok", okFilter);

  const [{ data, error }, { data: models }] = await Promise.all([
    query,
    supabase.from("llm_models").select("name").order("sort_order"),
  ]);
  const rows = (data ?? []) as Row[];
  const timed = rows.filter((row) => row.duration_ms != null);
  const avg = timed.length ? timed.reduce((sum, row) => sum + row.duration_ms!, 0) / timed.length / 1000 : null;
  const filtered = requestId || modelName || okFilter !== null;

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <p className="text-xs uppercase tracking-widest text-muted">LLM responses</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">
        {rows.length} {rows.length === 1 ? "response" : "responses"}
        {requestId && <span className="text-muted"> for request #{requestId}</span>}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Each reply OutNYC gets from an AI model. Newest first, up to 500. Not implemented yet.
        {avg !== null && ` Average time: ${avg.toFixed(1)}s.`}
      </p>

      {/* A plain GET form: the filters live in the URL */}
      <form autoComplete="off" data-form-type="other" className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        {requestId && <input type="hidden" name="request" value={requestId} />}
        <select name="model" defaultValue={modelName ?? ""} className="rounded-full border border-line-strong bg-card px-4 py-2 text-ink">
          <option value="">All models</option>
          {(models ?? []).map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        <select name="result" defaultValue={typeof result === "string" ? result : ""} className="rounded-full border border-line-strong bg-card px-4 py-2 text-ink">
          <option value="">Worked or failed</option>
          <option value="ok">Worked</option>
          <option value="failed">Failed</option>
        </select>
        <button className="rounded-full border border-line-strong px-5 py-2 text-ink hover:bg-card">Filter</button>
        {filtered && (
          <Link href="/llm-responses" className="px-2 text-muted hover:text-ink">
            Clear
          </Link>
        )}
      </form>

      {error && <p className="mt-6 text-sm text-down">Couldn&apos;t load responses: {error.message}</p>}
      {!error && rows.length === 0 && <p className="mt-8 text-sm text-ink-soft">No responses{filtered ? " match" : " yet"}.</p>}

      <ul className="mt-8 flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="tabular-nums text-muted">#{row.id}</span>
              <code className="rounded bg-paper px-1.5 py-0.5 text-xs text-ink">{row.model}</code>
              <span className={row.ok ? "text-accent" : "text-down"}>
                {row.ok ? "Worked" : "Failed"}
                {row.http_status && ` (${row.http_status})`}
              </span>
              <span className="tabular-nums text-ink-soft">{row.duration_ms != null ? `${(row.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
              <span className="text-ink-soft">{formatTime(row.created_at)}</span>
              {row.request_id && (
                <Link href={`/llm-responses?request=${row.request_id}`} className="ml-auto text-accent underline-offset-4 hover:underline">
                  Request #{row.request_id}
                </Link>
              )}
            </div>
            {row.response_text ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-ink-soft">
                  {row.response_text.slice(0, 140)}
                  {row.response_text.length > 140 && "…"}
                </summary>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-4 text-xs text-ink">{row.response_text}</pre>
              </details>
            ) : (
              <p className="mt-3 text-sm text-muted">No text.</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
