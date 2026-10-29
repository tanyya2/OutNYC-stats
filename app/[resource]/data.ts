import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resource } from "@/utils/resources";
import { formatDate } from "@/utils/plans";

export type Options = Record<string, { id: number; label: string }[]>;

// Rows of the tables that select fields point at, e.g. providers for a model
export async function loadOptions(supabase: SupabaseClient, resource: Resource): Promise<Options> {
  const selects = resource.fields.filter((field) => field.type === "select" && field.options);
  const lists = await Promise.all(
    selects.map(async (field) => {
      const { table, label } = field.options!;
      const { data } = await supabase.from(table).select(`id, ${label}`).order(label);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      return [field.name, rows.map((row) => ({ id: Number(row.id), label: String(row[label]) }))] as const;
    }),
  );
  return Object.fromEntries(lists);
}

// One table cell: dates as dates, yes/no for checkboxes, option labels for selects
export function formatCell(resource: Resource, options: Options, column: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (column === "created_at") return formatDate(String(value));
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (options[column]) return options[column].find((option) => option.id === value)?.label ?? `#${value}`;
  const text = String(value);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}
