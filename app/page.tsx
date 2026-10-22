import { requireAdmin } from "@/utils/auth";
import { signOut } from "./login/actions";

export default async function Home() {
  const { user } = await requireAdmin();

  return (
    <main className="min-h-screen bg-[#f3eee4] px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#d9d1c1] bg-[#fbf8f2] p-8">
        <p className="text-xs uppercase tracking-widest text-[#5f5a50]">OutNYC</p>
        <h1 className="mt-2 text-3xl text-[#1c1b19]">Admin</h1>
        <p className="mt-4 text-sm text-[#45413a]">Signed in as {user.email}</p>
        <form action={signOut} className="mt-6">
          <button className="rounded-full border border-[#cfc6b4] px-6 py-3 text-sm font-medium text-[#1c1b19] hover:bg-[#f3eee4]">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
