import { requireAdmin } from "@/utils/auth";

export default async function Home() {
  const { user } = await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="text-xs uppercase tracking-widest text-muted">Dashboard</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">Hello, admin</h1>
      <p className="mt-3 text-sm text-ink-soft">Signed in as {user.email}</p>
    </main>
  );
}
