import Link from "next/link";
import { requireAdmin } from "@/utils/auth";
import { Avatar } from "../avatar";

type Profile = {
  id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
};

// How many times each user_id appears in a list of rows
function countByUser(rows: { user_id: string }[] | null) {
  const counts = new Map<string, number>();
  for (const { user_id } of rows ?? []) counts.set(user_id, (counts.get(user_id) ?? 0) + 1);
  return counts;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

export default async function UsersPage() {
  const { supabase } = await requireAdmin();

  const [profiles, plans, votes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, created_at, first_name, last_name, avatar_url, is_superadmin")
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("user_id"),
    supabase.from("votes").select("user_id"),
  ]);

  const users = (profiles.data ?? []) as Profile[];
  const plansBy = countByUser(plans.data);
  const votesBy = countByUser(votes.data);

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 py-6">
      <p className="text-xs uppercase tracking-widest text-muted">Users</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">
        {users.length} {users.length === 1 ? "user" : "users"}
      </h1>

      {profiles.error ? (
        <p className="mt-6 text-sm text-ink-soft">Couldn&apos;t load users: {profiles.error.message}</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-widest text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 text-right font-medium">Plans made</th>
                <th className="px-5 py-3 text-right font-medium">Votes given</th>
                <th className="px-5 py-3 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "No name yet";
                return (
                  <tr key={user.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/users/${user.id}`} className="group flex items-center gap-3">
                        <Avatar url={user.avatar_url} name={name} size={36} />
                        <span className="text-ink group-hover:underline">{name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{formatDate(user.created_at)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink">{plansBy.get(user.id) ?? 0}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink">{votesBy.get(user.id) ?? 0}</td>
                    <td className="px-5 py-3">
                      {user.is_superadmin && (
                        <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-white">Admin</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
