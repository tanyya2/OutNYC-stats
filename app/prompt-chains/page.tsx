import Link from "next/link";
import { requireAdmin } from "@/utils/auth";
import { formatDate } from "@/utils/plans";

type Chain = {
  id: number;
  created_at: string;
  name: string;
  description: string | null;
  prompt_chain_steps: { id: number; step_order: number; name: string; kind: string; instructions: string | null }[];
  prompt_chain_mix: { weight: number }[] | { weight: number } | null;
};

const weightOf = (mix: Chain["prompt_chain_mix"]) => (Array.isArray(mix) ? (mix[0]?.weight ?? 0) : (mix?.weight ?? 0));

// Read only: the steps OutNYC goes through to turn a request into a plan
export default async function PromptChainsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("prompt_chains")
    .select("id, created_at, name, description, prompt_chain_steps(id, step_order, name, kind, instructions), prompt_chain_mix(weight)")
    .order("id");
  const chains = (data ?? []) as unknown as Chain[];
  const total = chains.reduce((sum, chain) => sum + weightOf(chain.prompt_chain_mix), 0);

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Prompt chains</p>
          <h1 className="mt-2 font-serif text-4xl text-ink">
            {chains.length} {chains.length === 1 ? "chain" : "chains"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Each chain is a list of steps for turning someone&apos;s request into a plan. Not implemented yet.
          </p>
        </div>
        <Link href="/chain-mix" className="rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink hover:bg-card">
          Edit the mix
        </Link>
      </div>

      {error && <p className="mt-6 text-sm text-down">Couldn&apos;t load prompt chains: {error.message}</p>}

      <div className="mt-8 flex flex-col gap-6">
        {chains.map((chain) => {
          const steps = [...chain.prompt_chain_steps].sort((a, b) => a.step_order - b.step_order);
          const share = total > 0 ? Math.round((weightOf(chain.prompt_chain_mix) / total) * 100) : 0;
          return (
            <section key={chain.id} className="rounded-2xl border border-line bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-muted">
                    Chain #{chain.id} · added {formatDate(chain.created_at)}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-ink">{chain.name}</h2>
                  {chain.description && <p className="mt-1 text-sm text-ink-soft">{chain.description}</p>}
                </div>
                <span className="rounded-full bg-paper px-3 py-1 text-sm tabular-nums text-ink-soft">
                  {share}% of new plans
                </span>
              </div>

              {steps.length === 0 ? (
                <p className="mt-4 text-sm text-ink-soft">No steps.</p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line text-xs uppercase tracking-widest text-muted">
                      <tr>
                        <th className="py-2 pr-4 font-normal">ID</th>
                        <th className="py-2 pr-4 font-normal">Step</th>
                        <th className="py-2 pr-4 font-normal">Name</th>
                        <th className="py-2 pr-4 font-normal">Kind</th>
                        <th className="py-2 font-normal">What it does</th>
                      </tr>
                    </thead>
                    <tbody>
                      {steps.map((step) => (
                        <tr key={step.id} className="border-b border-line align-top last:border-0">
                          <td className="py-3 pr-4 tabular-nums text-muted">{step.id}</td>
                          <td className="py-3 pr-4 tabular-nums text-ink">{step.step_order}</td>
                          <td className="py-3 pr-4 text-ink">{step.name}</td>
                          <td className="py-3 pr-4">
                            <code className="rounded bg-paper px-1.5 py-0.5 text-xs text-ink-soft">{step.kind}</code>
                          </td>
                          <td className="py-3 text-ink-soft">{step.instructions ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
