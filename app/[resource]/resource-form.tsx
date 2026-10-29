"use client";

import { useActionState, useLayoutEffect, useState } from "react";
import type { Field } from "@/utils/resources";
import type { FormState } from "./actions";

type Props = {
  fields: Field[];
  // select fields: id → label, already loaded by the page
  options: Record<string, { id: number; label: string }[]>;
  initial?: Record<string, unknown>;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
};

const input =
  "w-full rounded-xl border border-line-strong bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const label = "text-xs uppercase tracking-widest text-muted";

// Next keeps recently visited pages alive in the background (Activity), which would keep
// a half-filled form. Leaving the page bumps `visit`, so coming back starts fresh.
export function ResourceForm(props: Props) {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((v) => v + 1), []);
  return <Form key={visit} {...props} />;
}

function Form({ fields, options, initial, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  // After an error: what was typed. Otherwise the saved row; new rows start active and everything else empty.
  const start = (field: Field) => {
    if (state?.values) return field.type === "checkbox" ? state.values[field.name] === "on" : (state.values[field.name] ?? "");
    return initial?.[field.name] ?? (field.type === "checkbox" ? field.name === "is_active" || field.name === "thinking_off" : "");
  };

  return (
    <form action={formAction} autoComplete="off" data-form-type="other" className="flex max-w-2xl flex-col gap-5">
      {fields.map((field) => {
        const value = start(field);
        if (field.type === "checkbox") {
          return (
            <label key={field.name} className="flex items-center gap-3 text-sm text-ink">
              <input type="checkbox" name={field.name} defaultChecked={value === true} className="size-4 accent-accent" />
              {field.label}
            </label>
          );
        }
        return (
          <label key={field.name} className="flex flex-col gap-2">
            <span className={label}>
              {field.label}
              {field.required && <span className="text-down"> *</span>}
            </span>
            {field.type === "textarea" ? (
              <textarea
                name={field.name}
                defaultValue={String(value ?? "")}
                maxLength={field.max}
                rows={field.max && field.max > 500 ? 10 : 4}
                className={input}
              />
            ) : field.type === "select" ? (
              <select name={field.name} defaultValue={String(value ?? "")} className={input}>
                <option value="">Choose…</option>
                {(options[field.name] ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.name}
                type={field.type === "number" ? "number" : "text"}
                defaultValue={String(value ?? "")}
                maxLength={field.max}
                className={input}
              />
            )}
            {field.help && <span className="text-xs text-muted">{field.help}</span>}
          </label>
        );
      })}

      {state?.error && <p className="text-sm text-down">{state.error}</p>}
      <button
        disabled={pending}
        className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
