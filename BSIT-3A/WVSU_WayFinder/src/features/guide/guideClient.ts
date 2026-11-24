import { keywords, type GuideAnswer } from "../../../supabase/functions/ai-guide/logic";
import { isLiveConfigured, listProcesses, searchFaculty, searchPlaces } from "../../lib/data";
import { functionsUrl, publishableKey } from "../../lib/data/live";
import type { Lang } from "./strings";

export class GuideUnavailable extends Error {}

/** Calls the server-side ai-guide function. The model provider key never reaches the browser. */
export async function askGuide(q: string, lang: Lang, fetchImpl: typeof fetch = fetch): Promise<GuideAnswer> {
  if (!isLiveConfigured) throw new GuideUnavailable("not-configured");
  let res: Response;
  try {
    res = await fetchImpl(`${functionsUrl}/ai-guide`, {
      method: "POST",
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ q, lang }),
    });
  } catch {
    throw new GuideUnavailable("network");
  }
  if (!res.ok) throw new GuideUnavailable(`HTTP ${res.status}`);
  const body = (await res.json()) as Partial<GuideAnswer>;
  if (typeof body.answer !== "string" || !Array.isArray(body.citations)) throw new GuideUnavailable("bad-response");
  return { answer: body.answer, lang, citations: body.citations, grounded: Boolean(body.grounded) };
}

export interface FallbackHit { type: "place" | "process" | "faculty"; id: string; label: string; detail?: string; demo: boolean }

/** Labeled fallback: plain search over the directory and processes using the question's keywords. */
export async function fallbackSearch(q: string): Promise<FallbackHit[]> {
  const code = q.match(/[A-Za-z]{1,5}[\s-]?\d{1,4}[A-Za-z]?/)?.[0];
  // With a room code in the question, its pieces ("qh", "99") are not separate search terms: they would
  // offer QH 1 for "Where is QH 99?".
  const codeKey = code?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const terms = [code, ...keywords(q).filter((k) => !codeKey || !codeKey.includes(k))].filter(Boolean) as string[];
  const hits = new Map<string, FallbackHit>();
  for (const term of terms.slice(0, 4)) {
    const [places, procs, fac] = await Promise.allSettled([searchPlaces(term), listProcesses(term), searchFaculty(term)]);
    if (places.status === "fulfilled") for (const v of places.value.data)
      hits.set(`place:${v.place.id}`, { type: "place", id: v.place.id, label: v.place.name, detail: v.parent?.name, demo: places.value.mode === "demo" });
    if (procs.status === "fulfilled") for (const p of procs.value.data)
      hits.set(`process:${p.id}`, { type: "process", id: p.id, label: p.name, detail: `${p.steps.length} steps`, demo: p.isDemo });
    if (fac.status === "fulfilled") for (const f of fac.value.data)
      hits.set(`faculty:${f.id}`, { type: "faculty", id: f.id, label: f.fullName, detail: f.department, demo: f.isDemo });
  }
  return [...hits.values()].slice(0, 8);
}

/** A place opens on the map (building, floor plan and highlighted room), same as a cited place. */
export const linkFor = (type: FallbackHit["type"], id: string) =>
  type === "place" ? `/map?to=${encodeURIComponent(id)}` : type === "process" ? `/processes/${encodeURIComponent(id)}` : `/directory/faculty/${encodeURIComponent(id)}`;
