"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { getResource, readFields } from "@/utils/resources";

// values: what was typed, so the form can show it again next to the error
export type FormState = { error: string; values?: Record<string, string> } | undefined;

// Postgres "unique" errors read as gibberish; say what happened instead
function saveError(message: string, noun: string) {
  if (message.includes("duplicate key")) return `That ${noun} already exists.`;
  if (message.includes("foreign key")) return `Other rows still use this ${noun}, so it can't be removed.`;
  return `Couldn't save: ${message}`;
}

function typed(formData: FormData) {
  return Object.fromEntries([...formData.entries()].filter(([name]) => !name.startsWith("$")).map(([name, value]) => [name, String(value)]));
}

export async function createRow(key: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const resource = getResource(key);
  if (!resource) return { error: "Unknown page." };

  const result = readFields(resource, formData);
  if ("error" in result) return { error: result.error, values: typed(formData) };

  const { error } = await supabase.from(resource.table).insert(result.values);
  if (error) return { error: saveError(error.message, resource.noun), values: typed(formData) };

  redirect(`/${key}?saved=1`);
}

export async function updateRow(key: string, id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const resource = getResource(key);
  if (!resource || !Number.isInteger(id)) return { error: "Unknown row." };

  const result = readFields(resource, formData);
  if ("error" in result) return { error: result.error, values: typed(formData) };

  // .select() so a change blocked by RLS shows up as "nothing updated" instead of silent success
  const { data, error } = await supabase.from(resource.table).update(result.values).eq("id", id).select("id");
  if (error) return { error: saveError(error.message, resource.noun), values: typed(formData) };
  if (!data?.length) return { error: "Nothing was saved (not allowed, or the row is gone)." };

  redirect(`/${key}/${id}?saved=1`);
}

export async function deleteRow(key: string, id: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const resource = getResource(key);
  if (!resource || !Number.isInteger(id)) return { error: "Unknown row." };

  const { data, error } = await supabase.from(resource.table).delete().eq("id", id).select("id");
  if (error) return { error: saveError(error.message, resource.noun) };
  if (!data?.length) return { error: "Nothing was deleted (not allowed, or the row is gone)." };

  redirect(`/${key}?deleted=1`);
}
