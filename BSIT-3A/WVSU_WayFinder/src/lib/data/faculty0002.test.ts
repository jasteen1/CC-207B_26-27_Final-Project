// The live project has public.faculty (0002) but no faculty_directory: the Directory must fall back
// instead of failing, read only the columns 0002 grants to students, and enable "Show office on map"
// only from a VERIFIED office place. A college affiliation alone never does.
import { afterEach, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

const res = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
const NOT_FOUND = { code: "PGRST205", details: null, hint: null, message: "Could not find the table 'public.faculty_directory' in the schema cache" };
const teachers = [
  { id: "f-office", full_name: "Ana Reyes", department: "IT", college_id: "college-cict", office_id: "office-it" },
  { id: "f-college", full_name: "Ben Cruz", department: "Math", college_id: "college-cict", office_id: null },
  { id: "f-unverified", full_name: "Cora Diaz", department: "Bio", college_id: null, office_id: "office-hidden" },
];
// What RLS returns to a student: office-hidden is unverified, so it is simply absent.
const visiblePlaces = [
  { id: "office-it", kind: "office", name: "IT Faculty Office", floor: 2, lng: null, lat: null, status: "verified", parent_id: "bldg-cict",
    parent: { id: "bldg-cict", kind: "building", name: "CICT Building", lng: 122.5616, lat: 10.71315, status: "verified" } },
  { id: "college-cict", kind: "college", name: "College of ICT", floor: null, lng: null, lat: null, status: "verified", parent_id: null, parent: null },
];

async function load() {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (u: string) => {
    const path = decodeURIComponent(u.replace("https://example.supabase.co/rest/v1/", ""));
    calls.push(path);
    if (path.startsWith("faculty_directory")) return res(404, NOT_FOUND);
    if (path.startsWith("faculty?")) return res(200, path.includes("id=eq.f-college") ? [teachers[1]] : teachers);
    if (path.startsWith("places?")) return res(200, visiblePlaces);
    return res(404, {});
  }));
  vi.resetModules();
  return { live: await import("./live"), calls };
}

describe("faculty: faculty_directory missing → public.faculty (0002)", () => {
  it("search falls back on PGRST205, with only granted columns and no select=*", async () => {
    const { live, calls } = await load();
    const list = await live.liveSearchFaculty("");
    expect(list.map((f) => f.fullName)).toEqual(["Ana Reyes", "Ben Cruz", "Cora Diaz"]);
    const facultyCall = calls.find((c) => c.startsWith("faculty?"))!;
    expect(facultyCall).toContain("select=id,full_name,department,college_id,office_id,official_email,office_hours,verified_at");
    expect(facultyCall).not.toContain("select=*");
    expect(facultyCall).not.toMatch(/status|verified_by|source/); // never asks for ungranted columns
  });

  it("'Show office on map' only from a verified office; college alone or an unpublished office never", async () => {
    const { live } = await load();
    const [ana, ben, cora] = await live.liveSearchFaculty("");
    expect(ana.office).toMatchObject({ id: "office-it", parent: { name: "CICT Building" } });
    expect(ana.collegeUnit).toBe("College of ICT");
    expect(ben.office).toBeUndefined();
    expect(ben.collegeUnit).toBe("College of ICT");
    expect(cora.office).toBeUndefined();
  });

  it("detail by id uses the same fallback", async () => {
    const { live } = await load();
    expect((await live.liveGetFaculty("f-college"))?.fullName).toBe("Ben Cruz");
  });

  it("other failures are not swallowed (the UI shows Retry)", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal("fetch", vi.fn(async () => res(500, {})));
    vi.resetModules();
    const live = await import("./live");
    await expect(live.liveSearchFaculty("")).rejects.toMatchObject({ status: 500 });
  });
});
