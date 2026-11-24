// Supabase Edge Function: POST /functions/v1/ai-guide  { q: string, lang: "en" | "tl" | "hil" }
// Answers ONLY from published, verified rows read with the anon key (so RLS applies), using Claude
// with structured output. The Anthropic key lives in function secrets: `supabase secrets set ANTHROPIC_API_KEY=...`.
// Deploy: `supabase functions deploy ai-guide`.
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";
import { buildSystemPrompt, buildUserMessage, isLang, pickContext, sanitize, type SourceRecord } from "./logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const Answer = z.object({
  answer: z.string(),
  lang: z.enum(["en", "tl", "hil"]),
  citations: z.array(z.object({ type: z.enum(["place", "process", "faculty"]), id: z.string(), label: z.string() })),
  grounded: z.boolean(),
});

async function rest(path: string): Promise<Record<string, unknown>[]> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Accept: "application/json" } });
  return res.ok ? await res.json() : []; // a missing table just contributes no sources
}

async function loadSources(): Promise<SourceRecord[]> {
  const [places, processes, faculty] = await Promise.all([
    rest("places?select=id,kind,name,room_code,floor,parent:parent_id(name)&status=eq.verified&limit=500"),
    rest("processes?select=id,name,summary,process_steps(position,title,action)&limit=100"),
    rest("faculty_directory?select=record_id,full_name,college_unit,department,position_title&is_published=eq.true&review_status=eq.verified&limit=500"),
  ]);
  const out: SourceRecord[] = [];
  for (const p of places as any[]) {
    out.push({ type: "place", id: p.id, label: p.name,
      text: [p.kind, p.room_code && `room code ${p.room_code}`, p.parent?.name && `in ${p.parent.name}`, p.floor != null && `floor ${p.floor}`].filter(Boolean).join(", ") });
  }
  for (const p of processes as any[]) {
    const steps = (p.process_steps ?? []).sort((a: any, b: any) => a.position - b.position)
      .map((s: any) => `${s.position}. ${s.title}: ${s.action}`).join(" ");
    out.push({ type: "process", id: p.id, label: p.name, text: `${p.summary ?? ""} Steps: ${steps}` });
  }
  for (const f of faculty as any[]) {
    out.push({ type: "faculty", id: String(f.record_id), label: f.full_name,
      text: [f.position_title, f.department, f.college_unit].filter(Boolean).join(", ") });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "provider_not_configured" }, 503);

  let body: { q?: unknown; lang?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const q = typeof body.q === "string" ? body.q.trim().slice(0, 500) : "";
  const lang = isLang(body.lang) ? body.lang : "en";
  if (!q) return json({ error: "empty_question" }, 400);

  const context = pickContext(await loadSources(), q);
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(Answer) },
      system: buildSystemPrompt(lang),
      messages: [{ role: "user", content: buildUserMessage(q, context) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return json({ answer: "", lang, citations: [], grounded: false });
    }
    return json(sanitize(response.parsed_output, context, lang));
  } catch (_e) {
    return json({ error: "provider_unavailable" }, 502);
  }
});
