import Link from "next/link";
import { requireAdmin } from "@/utils/auth";
import { createPlan } from "../actions";
import { PlanForm } from "../plan-form";

export default async function NewPlanPage() {
  await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/plans" className="text-sm text-muted hover:text-ink">
        ← All plans
      </Link>
      <p className="mt-6 text-xs uppercase tracking-widest text-muted">Plans</p>
      <h1 className="mt-2 mb-6 font-serif text-4xl text-ink">New plan</h1>
      <PlanForm action={createPlan} isNew />
    </main>
  );
}
