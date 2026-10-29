"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

type Props = {
  action: (prev: FormState) => Promise<FormState>;
  noun: string;
  // Small "Delete" for a row in a list, instead of the full "Delete <noun>" button
  compact?: boolean;
};

// Asks first, since a delete can't be undone
export function DeleteRowButton({ action, noun, compact }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Delete this ${noun}? This can't be undone.`)) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <button
        disabled={pending}
        className={`self-start rounded-full border border-down font-medium text-down hover:bg-down hover:text-white disabled:opacity-60 ${compact ? "px-3 py-1 text-xs" : "px-5 py-2.5 text-sm"}`}
      >
        {pending ? "Deleting…" : compact ? "Delete" : `Delete ${noun}`}
      </button>
      {state?.error && <p className={compact ? "max-w-48 text-xs text-down" : "text-sm text-down"}>{state.error}</p>}
    </form>
  );
}
