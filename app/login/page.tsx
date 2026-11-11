"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(error.message);
      else if (!data.session) setInfo("Check your email to confirm your account, then log in.");
      else {
        router.push("/onboarding");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.push("/dashboard");
        router.refresh();
      }
    }
    setLoading(false);
  }

  const input =
    "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-blue-500";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Avyro</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {mode === "login" ? "Log in to your workspace" : "Create your account"}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <input className={input} placeholder="Full name" value={fullName}
              onChange={(e) => setFullName(e.target.value)} required />
          )}
          <input className={input} type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input className={input} type="password" placeholder="Password (min 6 characters)"
            value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {info && <p className="text-sm text-blue-400">{info}</p>}
          <button disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50">
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); }}
          className="mt-4 text-sm text-zinc-400 hover:text-zinc-200">
          {mode === "login" ? "No account? Sign up" : "Have an account? Log in"}
        </button>
      </div>
    </main>
  );
        }
