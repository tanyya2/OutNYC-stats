import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { getResource } from "@/utils/resources";
import { createRow } from "../actions";
import { loadOptions } from "../data";
import { ResourceForm } from "../resource-form";

export default async function NewRowPage({ params }: PageProps<"/[resource]/new">) {
  const { supabase } = await requireAdmin();
  const { resource: key } = await params;
  const resource = getResource(key);
  if (!resource) notFound();
  const options = await loadOptions(supabase, resource);

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <Link href={`/${key}`} className="text-sm text-muted hover:text-ink">
        ← {resource.title}
      </Link>
      <h1 className="mt-4 mb-8 font-serif text-4xl text-ink">New {resource.noun}</h1>
      <ResourceForm
        fields={resource.fields}
        options={options}
        action={createRow.bind(null, key)}
        submitLabel={`Add ${resource.noun}`}
      />
    </main>
  );
}
