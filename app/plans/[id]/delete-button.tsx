"use client";

import { useActionState } from "react";
import type { FormState } from "../actions";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  votes: number;
};

// Asks first; the plan's votes are deleted with it
export function DeleteButton({ action, votes }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const also = votes > 0 ? ` and its ${votes} ${votes === 1 ? "vote" : "votes"}` : "";
        if (!confirm(`Delete this plan${also}? This can't be undone.`)) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <button
        disabled={pending}
        className="self-start rounded-full border border-down px-5 py-2.5 text-sm font-medium text-down hover:bg-down hover:text-white disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete plan"}
      </button>
      {state?.error && <p className="text-sm text-down">{state.error}</p>}
    </form>
  );
}
