import { redirect } from "next/navigation";
import { getViewer } from "@/utils/auth";
import { SignInButton } from "./sign-in-button";
import { signOut } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer.status === "admin") redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3eee4] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#d9d1c1] bg-[#fbf8f2] p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-[#5f5a50]">OutNYC</p>
        <h1 className="mt-2 text-3xl text-[#1c1b19]">Admin</h1>

        {viewer.status === "signed-out" ? (
          <>
            {error && (
              <p className="mt-4 text-sm text-[#45413a]">Login didn&apos;t work, please try again.</p>
            )}
            <div className="mt-6">
              <SignInButton />
            </div>
          </>
        ) : (
          // Signed in but not an admin: no data, only a way out
          <>
            <p className="mt-6 font-medium text-[#1c1b19]">Not authorized</p>
            <p className="mt-1 text-sm text-[#45413a]">This Google account isn&apos;t an admin.</p>
            <form action={signOut} className="mt-6">
              <button className="rounded-full border border-[#cfc6b4] px-6 py-3 text-sm font-medium text-[#1c1b19] hover:bg-[#f3eee4]">
                Sign out
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
