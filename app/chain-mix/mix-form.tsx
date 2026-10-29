"use client";

import { useActionState, useLayoutEffect, useState } from "react";
import type { FormState } from "./actions";

type Props = {
  chains: { id: number; name: string; weight: number }[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

// Coming back to the page starts from what's saved, not a half-edited form
export function MixForm(props: Props) {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((v) => v + 1), []);
  return <Form key={visit} {...props} />;
}

function Form({ chains, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [weights, setWeights] = useState(() => Object.fromEntries(chains.map((chain) => [chain.id, String(chain.weight)])));
  const total = chains.reduce((sum, chain) => sum + (Number(weights[chain.id]) || 0), 0);

  return (
    <form action={formAction} autoComplete="off" data-form-type="other" className="flex max-w-2xl flex-col gap-4">
      {chains.map((chain) => {
        const weight = Number(weights[chain.id]) || 0;
        const share = total > 0 ? Math.round((weight / total) * 100) : 0;
        return (
          <label key={chain.id} className="flex items-center gap-4 rounded-2xl border border-line bg-card px-5 py-4">
            <span className="flex-1">
              <span className="block text-sm text-ink">{chain.name}</span>
              <span className="text-xs text-muted">Chain #{chain.id}</span>
            </span>
            <input
              name={`weight_${chain.id}`}
              type="number"
              min={0}
              max={1000}
              value={weights[chain.id]}
              onChange={(e) => setWeights({ ...weights, [chain.id]: e.target.value })}
              className="w-24 rounded-xl border border-line-strong bg-paper px-3 py-2 text-right text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
            />
            {/* Live share, so the effect of a change is clear before saving */}
            <span className="w-28 text-right text-sm tabular-nums text-ink-soft">{share}% of plans</span>
          </label>
        );
      })}

      {state?.error && <p className="text-sm text-down">{state.error}</p>}
      <button
        disabled={pending}
        className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save mix"}
      </button>
    </form>
  );
}
