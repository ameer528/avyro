import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("id, business_name, website_url, status")
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
      </h1>

      {profile ? (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Your business</p>
          <p className="mt-1 text-lg font-medium">{profile.business_name}</p>
          <p className="text-sm text-zinc-500">{profile.website_url}</p>
          <p className="mt-4 text-sm text-zinc-400">
            Next: ideal customer profile and prospect discovery (Phase 2).
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-300">Set up your business profile to get started.</p>
          <Link href="/onboarding"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
            Start onboarding
          </Link>
        </div>
      )}
    </main>
  );
}
