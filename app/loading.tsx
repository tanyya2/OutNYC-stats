// Shown while a page checks who is visiting. Also the <Suspense> boundary
// that lets every page read the login cookie (needed with cacheComponents).
export default function Loading() {
  return <p className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-muted">Loading…</p>;
}
