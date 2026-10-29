"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/auth";

export type FormState = { error: string } | undefined;

// One weight per chain (weight_<chain id>), saved together
export async function saveMix(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const rows: { chain_id: number; weight: number }[] = [];
  for (const [name, raw] of formData.entries()) {
    const match = /^weight_(\d+)$/.exec(name);
    if (!match) continue;
    const weight = Number(String(raw).trim());
    if (!Number.isInteger(weight) || weight < 0 || weight > 1000) return { error: "Weights must be whole numbers from 0 to 1000." };
    rows.push({ chain_id: Number(match[1]), weight });
  }
  if (rows.length === 0) return { error: "Nothing to save." };
  if (rows.every((row) => row.weight === 0)) return { error: "At least one chain needs a weight above 0." };

  // Chains without a mix row yet get one
  const { error } = await supabase
    .from("prompt_chain_mix")
    .upsert(
      rows.map((row) => ({ ...row, updated_at: new Date().toISOString() })),
      { onConflict: "chain_id" },
    );
  if (error) return { error: `Couldn't save: ${error.message}` };

  redirect("/chain-mix?saved=1");
}
