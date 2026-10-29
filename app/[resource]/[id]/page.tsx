import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { formatDate } from "@/utils/plans";
import { getResource } from "@/utils/resources";
import { deleteRow, updateRow } from "../actions";
import { loadOptions } from "../data";
import { DeleteRowButton } from "../delete-row-button";
import { ResourceForm } from "../resource-form";

export default async function EditRowPage({ params, searchParams }: PageProps<"/[resource]/[id]">) {
  const { supabase } = await requireAdmin();
  const { resource: key, id } = await params;
  const { saved } = await searchParams;
  const resource = getResource(key);
  if (!resource || !/^\d+$/.test(id)) notFound();

  const [{ data }, options] = await Promise.all([
    supabase.from(resource.table).select("*").eq("id", Number(id)).maybeSingle(),
    loadOptions(supabase, resource),
  ]);
  if (!data) notFound();
  const row = data as Record<string, unknown>;

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <Link href={`/${key}`} className="text-sm text-muted hover:text-ink">
        ← {resource.title}
      </Link>
      <p className="mt-4 text-xs uppercase tracking-widest text-muted">
        {resource.noun} #{id}
        {typeof row.created_at === "string" && ` · added ${formatDate(row.created_at)}`}
      </p>
      <h1 className="mt-2 mb-8 font-serif text-4xl text-ink">Edit {resource.noun}</h1>
      {saved && <p className="mb-6 text-sm text-ink-soft">Saved.</p>}

      <ResourceForm
        fields={resource.fields}
        options={options}
        initial={row}
        action={updateRow.bind(null, key, Number(id))}
        submitLabel="Save changes"
      />

      <div className="mt-12 border-t border-line pt-8">
        <DeleteRowButton action={deleteRow.bind(null, key, Number(id))} noun={resource.noun} />
      </div>
    </main>
  );
}
