import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { categoryLabel, formatDate, formatDuration, fullName, one, parseContent } from "@/utils/plans";
import { deletePlan, updatePlan } from "../actions";
import { PlanForm } from "../plan-form";
import { DeleteButton } from "./delete-button";

type Row = {
  id: number;
  created_at: string;
  neighborhood: string | null;
  inputs: { radiusMiles?: number | null; categories?: string[]; purpose?: string; budget?: string; openNow?: boolean } | null;
  prompt: string | null;
  model: string | null;
  content: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
  votes: { value: number }[];
};

export default async function PlanPage({ params, searchParams }: PageProps<"/plans/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();

  const { data } = await supabase
    .from("plans")
    .select("id, created_at, neighborhood, inputs, prompt, model, content, profiles(first_name, last_name), votes(value)")
    .eq("id", Number(id))
    .maybeSingle();
  if (!data) notFound();

  const row = data as unknown as Row;
  const plan = parseContent(row.content);
  const up = row.votes.filter((vote) => vote.value === 1).length;
  const down = row.votes.filter((vote) => vote.value === -1).length;
  const minutes = plan?.stops.reduce((total, stop) => total + (Number(stop.minutes) || 0), 0) ?? 0;
  const inputs = row.inputs ?? {};

  const facts = [
    { label: "Score", value: `${up - down > 0 ? "+" : ""}${up - down}`, note: `👍 ${up} · 👎 ${down}` },
    { label: "Time", value: formatDuration(minutes), note: `${plan?.stops.length ?? 0} stops` },
    { label: "Budget", value: inputs.budget || "—", note: inputs.radiusMiles ? `within ${inputs.radiusMiles} mi` : "" },
    { label: "Made by", value: row.model || "—", note: "model" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6">
      <Link href="/plans" className="text-sm text-muted hover:text-ink">
        ← All plans
      </Link>

      <p className="mt-6 text-xs uppercase tracking-widest text-muted">
        {[`Plan #${row.id}`, `by ${fullName(one(row.profiles))}`, formatDate(row.created_at)].join(" · ")}
      </p>
      <h1 className="mt-2 font-serif text-4xl leading-tight text-ink">
        {plan?.title || <span className="text-muted">Untitled plan</span>}
      </h1>
      {saved && <p className="mt-3 text-sm text-accent">Saved.</p>}

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="bg-card p-4">
            <dt className="text-xs uppercase tracking-widest text-muted">{fact.label}</dt>
            <dd className="mt-1 truncate font-serif text-2xl text-ink">{fact.value}</dd>
            <dd className="text-xs text-muted">{fact.note}</dd>
          </div>
        ))}
      </dl>

      {/* What the user asked OutNYC for (read only) */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-5 text-sm text-ink-soft">
        <h2 className="text-xs uppercase tracking-widest text-muted">What they asked for</h2>
        <p className="mt-2">
          <span className="text-muted">Vibe:</span> {inputs.purpose ? `“${inputs.purpose}”` : "—"}
        </p>
        <p className="mt-1">
          <span className="text-muted">Categories:</span>{" "}
          {inputs.categories?.length ? inputs.categories.map(categoryLabel).join(", ") : "any"}
          {inputs.openNow !== undefined && ` · open now: ${inputs.openNow ? "yes" : "no"}`}
        </p>
        {row.prompt && (
          <details className="mt-3">
            <summary className="cursor-pointer text-muted hover:text-ink">Prompt sent to the AI</summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-paper p-3 text-xs whitespace-pre-wrap">{row.prompt}</pre>
          </details>
        )}
      </section>

      <h2 className="mt-10 mb-4 font-serif text-2xl text-ink">Edit</h2>
      {!plan && (
        <p className="mb-6 text-sm text-down">
          This plan&apos;s content can&apos;t be read, so OutNYC can&apos;t show it. Fill in the form to fix it.
        </p>
      )}
      <PlanForm
        action={updatePlan.bind(null, row.id)}
        initial={{
          title: plan?.title ?? "",
          neighborhood: row.neighborhood ?? "",
          tip: plan?.tip ?? "",
          stops: (plan?.stops ?? []).map((stop) => ({
            name: String(stop.name ?? ""),
            category: String(stop.category ?? ""),
            minutes: Number(stop.minutes) || 0,
            note: String(stop.note ?? ""),
          })),
        }}
      />

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="font-serif text-2xl text-ink">Delete</h2>
        <p className="mt-2 mb-4 text-sm text-ink-soft">Removes the plan and its votes from OutNYC for everyone.</p>
        <DeleteButton action={deletePlan.bind(null, row.id)} votes={up + down} />
      </section>
    </main>
  );
}
