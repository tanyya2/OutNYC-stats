import Link from "next/link";
import { requireAdmin } from "@/utils/auth";
import { saveMix } from "./actions";
import { MixForm } from "./mix-form";

type Chain = { id: number; name: string; prompt_chain_mix: { weight: number }[] | { weight: number } | null };

export default async function ChainMixPage({ searchParams }: PageProps<"/chain-mix">) {
  const { supabase } = await requireAdmin();
  const { saved } = await searchParams;
  const { data, error } = await supabase.from("prompt_chains").select("id, name, prompt_chain_mix(weight)").order("id");

  const chains = ((data ?? []) as unknown as Chain[]).map((chain) => {
    const mix = Array.isArray(chain.prompt_chain_mix) ? chain.prompt_chain_mix[0] : chain.prompt_chain_mix;
    return { id: chain.id, name: chain.name, weight: mix?.weight ?? 0 };
  });

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <Link href="/prompt-chains" className="text-sm text-muted hover:text-ink">
        ← Prompt chains
      </Link>
      <p className="mt-4 text-xs uppercase tracking-widest text-muted">Prompt chain mix</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">Which chain makes new plans</h1>
      <p className="mt-2 mb-8 max-w-2xl text-sm text-ink-soft">
        How often each chain will be picked for a new plan. A weight of 0 turns a chain off. Not implemented yet.
      </p>

      {saved && <p className="mb-6 text-sm text-ink-soft">Mix saved.</p>}
      {error && <p className="mb-6 text-sm text-down">Couldn&apos;t load the mix: {error.message}</p>}
      {!error && chains.length === 0 && <p className="text-sm text-ink-soft">No prompt chains yet.</p>}
      {chains.length > 0 && <MixForm chains={chains} action={saveMix} />}
    </main>
  );
}
