import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/auth";
import { columnLabel, getResource } from "@/utils/resources";
import { deleteRow } from "./actions";
import { formatCell, loadOptions } from "./data";
import { DeleteRowButton } from "./delete-row-button";

export default async function ResourceListPage({ params, searchParams }: PageProps<"/[resource]">) {
  const { supabase } = await requireAdmin();
  const { resource: key } = await params;
  const { q, saved, deleted } = await searchParams;
  const resource = getResource(key);
  if (!resource) notFound();
  const query = (typeof q === "string" ? q : "").trim();

  const [{ data, error }, options] = await Promise.all([
    supabase.from(resource.table).select("*").order(resource.orderBy.column, { ascending: resource.orderBy.ascending }),
    loadOptions(supabase, resource),
  ]);
  const rows = (data ?? []) as Record<string, unknown>[];

  // Search every column shown in the list
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter((row) => {
    const haystack = resource.columns.map((column) => formatCell(resource, options, column, row[column])).join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">{resource.title}</p>
          <h1 className="mt-2 font-serif text-4xl text-ink">
            {query ? `${shown.length} of ${rows.length}` : rows.length} {rows.length === 1 ? resource.noun : `${resource.noun}s`}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">{resource.description}</p>
        </div>
        <Link
          href={`/${key}/new`}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          New {resource.noun}
        </Link>
      </div>

      {saved && <p className="mt-4 text-sm text-ink-soft">Saved.</p>}
      {deleted && <p className="mt-4 text-sm text-ink-soft">Deleted.</p>}

      {/* A plain GET form: the search lives in the URL */}
      <form autoComplete="off" data-form-type="other" className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search"
          className="w-full max-w-md rounded-full border border-line-strong bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button className="rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink hover:bg-card">Search</button>
        {query && (
          <Link href={`/${key}`} className="self-center px-2 text-sm text-muted hover:text-ink">
            Clear
          </Link>
        )}
      </form>

      {error && <p className="mt-6 text-sm text-down">Couldn&apos;t load {resource.title.toLowerCase()}: {error.message}</p>}
      {!error && shown.length === 0 && (
        <p className="mt-8 text-sm text-ink-soft">{rows.length === 0 ? `No ${resource.noun}s yet.` : "Nothing matches."}</p>
      )}

      {shown.length > 0 && (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-widest text-muted">
              <tr>
                <th className="px-4 py-3 font-normal">ID</th>
                {resource.columns.map((column) => (
                  <th key={column} className="px-4 py-3 font-normal">
                    {columnLabel(resource, column)}
                  </th>
                ))}
                <th className="px-4 py-3 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={String(row.id)} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-4 py-3 tabular-nums">
                    <Link href={`/${key}/${row.id}`} className="text-accent underline-offset-4 hover:underline">
                      {String(row.id)}
                    </Link>
                  </td>
                  {resource.columns.map((column) => (
                    <td key={column} className="px-4 py-3 text-ink-soft">
                      {formatCell(resource, options, column, row[column])}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-start justify-end gap-2">
                      <Link
                        href={`/${key}/${row.id}`}
                        className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink hover:bg-paper"
                      >
                        Edit
                      </Link>
                      <DeleteRowButton action={deleteRow.bind(null, key, Number(row.id))} noun={resource.noun} compact />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
