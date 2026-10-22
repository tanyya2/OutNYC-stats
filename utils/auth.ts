import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Who is visiting? Signed out, signed in but not admin, or admin.
// cache() = asked once per page load, however many places call it.
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" as const };

  const { data: isAdmin } = await supabase.rpc("is_superadmin");
  if (isAdmin !== true) return { status: "not-admin" as const, user };

  return { status: "admin" as const, user, supabase };
});

// First line of every admin page and server action.
// Anyone who isn't an admin is sent to /login and never reaches the data.
export async function requireAdmin() {
  const viewer = await getViewer();
  if (viewer.status !== "admin") redirect("/login");
  return viewer;
}
