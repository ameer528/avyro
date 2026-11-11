"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  business_name: string | null;
  description: string | null;
  industry: string | null;
  target_audience: string | null;
  pricing_info: string | null;
  unique_selling_proposition: string | null;
  geographic_market: string | null;
  positioning: string | null;
  services: { name: string; description?: string | null }[];
};

const FIELDS: [keyof Profile, string, boolean][] = [
  ["business_name", "Business name", false],
  ["description", "Description", true],
  ["industry", "Industry", false],
  ["target_audience", "Target audience", true],
  ["geographic_market", "Geographic market", false],
  ["unique_selling_proposition", "Unique selling proposition", true],
  ["positioning", "Positioning", true],
  ["pricing_info", "Pricing (if public)", true],
];

export default function Onboarding() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analyze-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    }
    setLoading(false);
  }

  async function confirm() {
    if (!profile) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("business_profiles")
      .update({
        business_name: profile.business_name,
        description: profile.description,
        industry: profile.industry,
        target_audience: profile.target_audience,
        pricing_info: profile.pricing_info,
        unique_selling_proposition: profile.unique_selling_proposition,
        geographic_market: profile.geographic_market,
        positioning: profile.positioning,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    setLoading(false);
    if (error) return setError(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  const box =
    "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-blue-500";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Tell us about your business</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Enter your website. AI reads it and builds your profile. You review everything before it is saved.
      </p>

      {!profile && (
        <form onSubmit={analyze} className="mt-6 space-y-3">
          <input className={box} placeholder="yourwebsite.com" value={url}
            onChange={(e) => setUrl(e.target.value)} required />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50">
            {loading ? "Analyzing (up to 30s)..." : "Analyze website"}
          </button>
        </form>
      )}

      {profile && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-blue-400">
            AI-generated from your website. Edit anything that is wrong.
          </p>
          {FIELDS.map(([key, label, multi]) => (
            <label key={key} className="block">
              <span className="text-xs text-zinc-400">{label}</span>
              {multi ? (
                <textarea className={`${box} mt-1`} rows={3}
                  value={(profile[key] as string) ?? ""}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
              ) : (
                <input className={`${box} mt-1`}
                  value={(profile[key] as string) ?? ""}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
              )}
            </label>
          ))}

          <div>
            <span className="text-xs text-zinc-400">Services found</span>
            <ul className="mt-1 space-y-1 text-sm text-zinc-300">
              {profile.services.length === 0 && <li className="text-zinc-500">None detected</li>}
              {profile.services.map((s, i) => (
                <li key={i}>• {s.name}</li>
              ))}
            </ul>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button onClick={confirm} disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50">
              {loading ? "Saving..." : "Confirm profile"}
            </button>
            <button onClick={() => setProfile(null)}
              className="rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900">
              Re-analyze
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
  
