"use client";

import { Fragment, useActionState, useLayoutEffect, useState } from "react";
import { BUDGETS, CATEGORIES, STOPS } from "@/utils/plans";
import type { FormState } from "./actions";

type StopRow = { key: number; name: string; category: string; minutes: string; note: string };

export type PlanFormValues = {
  title: string;
  neighborhood: string;
  tip: string;
  stops: { name: string; category: string; minutes: number; note: string }[];
};

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: PlanFormValues;
  // New plans also get a budget and a vibe (saved in inputs, like OutNYC)
  isNew?: boolean;
};

const input =
  "w-full rounded-xl border border-line-strong bg-card px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const label = "text-xs uppercase tracking-widest text-muted";
// Smaller name above each field inside a stop
const fieldLabel = "text-xs text-muted";

let nextKey = 0;
const blankStop = (): StopRow => ({ key: nextKey++, name: "", category: "", minutes: "", note: "" });

// Next keeps recently visited pages alive in the background (Activity), which would keep
// a half-filled form. Leaving the page bumps `visit`, so coming back starts fresh.
export function PlanForm(props: Props) {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((v) => v + 1), []);
  return <Form key={visit} {...props} />;
}

// Every field is controlled, so a validation error never wipes what was typed.
function Form({ action, initial, isNew }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? "");
  const [tip, setTip] = useState(initial?.tip ?? "");
  const [budget, setBudget] = useState("$$");
  const [vibe, setVibe] = useState("");
  const [stops, setStops] = useState<StopRow[]>(() =>
    initial
      ? initial.stops.map((stop) => ({
          key: nextKey++,
          name: stop.name,
          category: stop.category,
          minutes: String(stop.minutes),
          note: stop.note,
        }))
      : Array.from({ length: STOPS.min }, blankStop),
  );

  const change = (key: number, field: keyof StopRow, value: string) =>
    setStops((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

  // Swap a stop with the next one: the order is the walking route
  const swap = (index: number) =>
    setStops((rows) => {
      const next = [...rows];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={label}>Title</span>
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. A slow Sunday in the West Village"
            maxLength={120}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Neighborhood</span>
          <input
            name="neighborhood"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="e.g. Hell's Kitchen, Manhattan"
            maxLength={100}
            className={input}
          />
        </label>
        {isNew && (
          <label className="flex flex-col gap-1.5">
            <span className={label}>Budget</span>
            <select name="budget" value={budget} onChange={(e) => setBudget(e.target.value)} className={input}>
              {BUDGETS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
        )}
        {isNew && (
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={label}>Vibe (optional)</span>
            <input
              name="vibe"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              placeholder="e.g. A slow, bookish Sunday"
              maxLength={200}
              className={input}
            />
          </label>
        )}
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className={`${label} mb-2`}>
          Stops ({STOPS.min}–{STOPS.max}, in walking order)
        </legend>
        {stops.map((stop, i) => (
          <Fragment key={stop.key}>
            {i > 0 && (
              <button
                type="button"
                onClick={() => swap(i - 1)}
                aria-label={`Swap stop ${i} and stop ${i + 1}`}
                className="self-center rounded-full border border-line-strong px-4 py-1 text-xs text-ink-soft hover:bg-card hover:text-ink"
              >
                ⇅ Swap
              </button>
            )}
            <div className="rounded-2xl border border-line bg-card p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-serif text-lg text-ink">Stop {i + 1}</span>
                <div className="flex gap-3 text-sm">
                  {stops.length > STOPS.min && (
                    <button
                      type="button"
                      onClick={() => setStops((rows) => rows.filter((row) => row.key !== stop.key))}
                      className="text-muted hover:text-ink"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_10rem_9rem]">
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Place name</span>
                  <input
                    name="stop_name"
                    value={stop.name}
                    onChange={(e) => change(stop.key, "name", e.target.value)}
                    placeholder="e.g. Joe's Pizza"
                    maxLength={120}
                    className={input}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Category</span>
                  <select
                    name="stop_category"
                    value={stop.category}
                    onChange={(e) => change(stop.key, "category", e.target.value)}
                    className={input}
                  >
                    <option value="">Pick one</option>
                    {Object.entries(CATEGORIES).map(([value, name]) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Minutes at this stop</span>
                  <input
                    name="stop_minutes"
                    type="number"
                    min={5}
                    max={480}
                    value={stop.minutes}
                    onChange={(e) => change(stop.key, "minutes", e.target.value)}
                    placeholder="e.g. 45"
                    className={input}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-3">
                  <span className={fieldLabel}>What to do here</span>
                  <textarea
                    name="stop_note"
                    value={stop.note}
                    onChange={(e) => change(stop.key, "note", e.target.value)}
                    placeholder="e.g. Grab a classic slice and eat it on the walk to the pier"
                    maxLength={500}
                    rows={2}
                    className={input}
                  />
                </label>
              </div>
            </div>
          </Fragment>
        ))}
        {stops.length < STOPS.max && (
          <button
            type="button"
            onClick={() => setStops((rows) => [...rows, blankStop()])}
            className="mt-1.5 self-start rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink hover:bg-card"
          >
            Add a stop
          </button>
        )}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className={label}>Tip (optional)</span>
        <textarea
          name="tip"
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          placeholder="e.g. Go before noon to skip the lines"
          maxLength={500}
          rows={2}
          className={input}
        />
      </label>

      {state?.error && <p className="text-sm text-down">{state.error}</p>}

      <button
        disabled={pending}
        className="self-start rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : isNew ? "Create plan" : "Save changes"}
      </button>
    </form>
  );
}
