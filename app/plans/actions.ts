"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { BUDGETS, CATEGORIES, STOPS, parseContent, type PlanContent, type PlanStop } from "@/utils/plans";

export type FormState = { error: string } | undefined;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const texts = (formData: FormData, name: string) => formData.getAll(name).map((value) => String(value).trim());

// Reads and checks the plan form. Returns the new content, or an error to show.
function readForm(formData: FormData, old: PlanContent | null) {
  const title = text(formData, "title");
  const tip = text(formData, "tip");
  const names = texts(formData, "stop_name");
  const categories = texts(formData, "stop_category");
  const minutes = texts(formData, "stop_minutes");
  const notes = texts(formData, "stop_note");

  if (!title || title.length > 120) return { error: "Title is required (up to 120 characters)." };
  if (tip.length > 500) return { error: "Keep the tip under 500 characters." };
  if (names.length < STOPS.min || names.length > STOPS.max) {
    return { error: `A plan needs ${STOPS.min}–${STOPS.max} stops.` };
  }

  const stops: PlanStop[] = [];
  const reused = new Set<PlanStop>();
  for (let i = 0; i < names.length; i++) {
    const n = i + 1;
    const mins = Number(minutes[i]);
    if (!names[i] || names[i].length > 120) return { error: `Stop ${n}: name is required (up to 120 characters).` };
    if (!Object.hasOwn(CATEGORIES, categories[i])) return { error: `Stop ${n}: pick a category.` };
    if (!Number.isInteger(mins) || mins < 5 || mins > 480) return { error: `Stop ${n}: minutes must be 5–480.` };
    if (!notes[i] || notes[i].length > 500) return { error: `Stop ${n}: note is required (up to 500 characters).` };

    // Same place as before (same name) → keep its Google id and old extras, wherever it moved.
    // Renamed or new → a different place, so an old place id would point to the wrong spot.
    const before = old?.stops.find((stop) => stop.name === names[i] && !reused.has(stop));
    if (before) reused.add(before);
    const extras = before ?? {};
    stops.push({ ...extras, name: names[i], category: categories[i], minutes: mins, note: notes[i] });
  }

  // Keep any other top-level fields the plan had
  const content: PlanContent = { ...old, title, stops, tip };
  return { content };
}

export async function createPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const neighborhood = text(formData, "neighborhood");
  const budget = text(formData, "budget");
  const vibe = text(formData, "vibe");
  if (!neighborhood || neighborhood.length > 100) return { error: "Neighborhood is required (up to 100 characters)." };
  if (!BUDGETS.includes(budget as (typeof BUDGETS)[number])) return { error: "Pick a budget." };
  if (vibe.length > 200) return { error: "Keep the vibe under 200 characters." };

  const result = readForm(formData, null);
  if (result.error !== undefined) return { error: result.error };

  // user_id defaults to the logged-in user (you). Same inputs shape as OutNYC plans.
  const { data, error } = await supabase
    .from("plans")
    .insert({
      neighborhood,
      inputs: {
        radiusMiles: null,
        categories: [...new Set(result.content.stops.map((stop) => stop.category))],
        purpose: vibe,
        budget,
        openNow: false,
      },
      places: [],
      prompt: "(written in the admin, no AI prompt)",
      model: "admin",
      content: JSON.stringify(result.content),
    })
    .select("id")
    .single();
  if (error) return { error: `Couldn't save: ${error.message}` };

  redirect(`/plans/${data.id}?saved=1`);
}

export async function updatePlan(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  if (!Number.isInteger(id)) return { error: "Unknown plan." };

  const neighborhood = text(formData, "neighborhood");
  if (!neighborhood || neighborhood.length > 100) return { error: "Neighborhood is required (up to 100 characters)." };

  const { data: row } = await supabase.from("plans").select("content").eq("id", id).maybeSingle();
  if (!row) return { error: "This plan no longer exists." };

  const result = readForm(formData, parseContent(row.content));
  if (result.error !== undefined) return { error: result.error };

  // .select() so a change blocked by RLS shows up as "nothing updated" instead of silent success
  const { data, error } = await supabase
    .from("plans")
    .update({ neighborhood, content: JSON.stringify(result.content) })
    .eq("id", id)
    .select("id");
  if (error) return { error: `Couldn't save: ${error.message}` };
  if (!data?.length) return { error: "Nothing was saved (not allowed, or the plan is gone)." };

  redirect(`/plans/${id}?saved=1`);
}

export async function deletePlan(id: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  if (!Number.isInteger(id)) return { error: "Unknown plan." };

  // Votes point at the plan, so they go first
  const votes = await supabase.from("votes").delete().eq("plan_id", id);
  if (votes.error) return { error: `Couldn't delete the plan's votes: ${votes.error.message}` };

  const { data, error } = await supabase.from("plans").delete().eq("id", id).select("id");
  if (error) return { error: `Couldn't delete the plan: ${error.message}` };
  if (!data?.length) return { error: "Nothing was deleted (not allowed, or the plan is gone)." };

  redirect("/plans?deleted=1");
}
