import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You extract a business profile from website text.
Rules:
- Use ONLY information present in the provided page content.
- If a field is not stated, return null. Never guess or invent. Never invent pricing.
- Return valid JSON only, with exactly these keys:
{
  "business_name": string|null,
  "description": string|null,
  "industry": string|null,
  "target_audience": string|null,
  "pricing_info": string|null,
  "unique_selling_proposition": string|null,
  "geographic_market": string|null,
  "positioning": string|null,
  "services": [{"name": string, "description": string|null, "category": string|null}],
  "portfolio": [{"title": string, "description": string|null}]
}`;

function normalizeUrl(raw: string): string | null {
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    const h = u.hostname.toLowerCase();
    if (!["http:", "https:"].includes(u.protocol)) return null;
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(":")) return null;
    if (!h.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const url = normalizeUrl((body.url || "").trim());
  if (!url) return NextResponse.json({ error: "Enter a valid website URL" }, { status: 400 });

  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json({ error: "Server is missing GEMINI_API_KEY" }, { status: 500 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No workspace found" }, { status: 400 });
  const orgId = membership.org_id as string;

  const { data: row, error: insertErr } = await supabase
    .from("business_profiles")
    .insert({ org_id: orgId, website_url: url, status: "analyzing" })
    .select("id")
    .single();
  if (insertErr || !row)
    return NextResponse.json({ error: insertErr?.message || "Could not start analysis" }, { status: 500 });

  const fail = async (message: string, status = 502) => {
    await supabase.from("business_profiles").update({ status: "failed" }).eq("id", row.id);
    return NextResponse.json({ error: message }, { status });
  };

  try {
    // 1. Read the website as text (Jina Reader)
    const headers: Record<string, string> = { Accept: "text/plain" };
    if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
    const pageRes = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: AbortSignal.timeout(25000),
    });
    if (!pageRes.ok) return fail("Could not read that website. Check the URL or fill in details manually.");
    const pageText = (await pageRes.text()).slice(0, 15000);
    if (pageText.trim().length < 100)
      return fail("The website had too little readable content to analyze.");

    // 2. Extract structured profile with Gemini
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            { role: "user", parts: [{ text: `Website URL: ${url}\n\nPage content:\n${pageText}` }] },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(40000),
      }
    );
    if (!aiRes.ok) return fail("AI analysis failed. Try again in a moment.");
    const aiData = await aiRes.json();
    const text = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fail("AI returned an empty result.");

    let parsed: any;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      return fail("AI returned an unreadable result. Try again.");
    }

    const services: { name: string; description?: string | null; category?: string | null }[] =
      Array.isArray(parsed.services) ? parsed.services.filter((s: any) => s?.name).slice(0, 20) : [];

    // 3. Save
    const fields = {
      business_name: parsed.business_name ?? null,
      description: parsed.description ?? null,
      industry: parsed.industry ?? null,
      target_audience: parsed.target_audience ?? null,
      pricing_info: parsed.pricing_info ?? null,
      unique_selling_proposition: parsed.unique_selling_proposition ?? null,
      geographic_market: parsed.geographic_market ?? null,
      positioning: parsed.positioning ?? null,
      portfolio: Array.isArray(parsed.portfolio) ? parsed.portfolio.slice(0, 20) : [],
      raw_analysis: { source_url: url, model, extracted: parsed },
      status: "needs_review",
    };
    const { error: updErr } = await supabase.from("business_profiles").update(fields).eq("id", row.id);
    if (updErr) return fail(updErr.message, 500);

    if (services.length) {
      await supabase.from("services").insert(
        services.map((s) => ({
          org_id: orgId,
          business_profile_id: row.id,
          name: String(s.name).slice(0, 200),
          description: s.description ?? null,
          category: s.category ?? null,
        }))
      );
    }

    await supabase.from("activity_logs").insert({
      org_id: orgId,
      user_id: user.id,
      action: "business_profile.analyzed",
      entity_type: "business_profile",
      entity_id: row.id,
    });

    return NextResponse.json({
      profile: { id: row.id, ...fields, services: services.map((s) => ({ name: s.name, description: s.description })) },
    });
  } catch {
    return fail("Analysis timed out or failed. Try again.");
  }
                            }
    
