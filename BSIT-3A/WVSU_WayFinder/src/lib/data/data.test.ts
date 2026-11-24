import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load() {
  vi.resetModules();
  return import("./index");
}

describe("demo mode (no Supabase env)", () => {
  it("finds a known room with its building and floor, labeled demo", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const { searchPlaces } = await load();
    const r = await searchPlaces("cb 203");
    expect(r.mode).toBe("demo");
    expect(r.notice).toMatch(/DEMO/);
    expect(r.data).toHaveLength(1);
    expect(r.data[0].place.id).toBe("room-demo-cb-203");
    expect(r.data[0].place.floor).toBe(2);
    expect(r.data[0].parent?.name).toBe("Demo College Building");
  });

  it("returns no results for an unknown room", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const { searchPlaces } = await load();
    expect((await searchPlaces("zz 999")).data).toEqual([]);
  });

  it("uses the same place ID for search and detail lookups", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const { searchPlaces, getPlace } = await load();
    const id = (await searchPlaces("CB203")).data[0].place.id;
    expect((await getPlace(id)).data?.place.roomCode).toBe("CB203");
  });
});

describe("live mode (Supabase env set, fetch mocked)", () => {
  const env = () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
  };

  it("queries PostgREST for verified rows by normalized room code", async () => {
    env();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "room-cb-203", kind: "room", name: "CB 203", short_name: null, room_code: "CB203", floor: 2, parent_id: "bldg-cb",
          lng: null, lat: null, status: "verified", source: "x", parent: { id: "bldg-cb", kind: "building", name: "CB", short_name: null, room_code: null, floor: null, parent_id: null, lng: 1, lat: 2, status: "verified", source: null } },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    const { searchPlaces } = await load();
    const r = await searchPlaces("cb 203");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/rest/v1/places?");
    expect(calledUrl).toContain("status=eq.verified");
    expect(calledUrl).toContain("room_code=eq.CB203");
    expect(fetchMock.mock.calls[0][1].headers.apikey).toBe("anon-key");
    expect(r.mode).toBe("live");
    expect(r.notice).toBeUndefined();
    expect(r.data[0].parent?.lat).toBe(2);
  });

  it("an empty live result stays empty (never padded with demo data)", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const { searchPlaces } = await load();
    const r = await searchPlaces("cb 203");
    expect(r.mode).toBe("live");
    expect(r.data).toEqual([]);
  });

  it("a failed request (HTTP 500) rejects: live mode never substitutes demo records", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { searchPlaces } = await load();
    await expect(searchPlaces("cb 203")).rejects.toThrow(/500/);
  });

  it("a network error rejects the same way", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { searchPlaces } = await load();
    await expect(searchPlaces("cb 203")).rejects.toThrow();
  });
});

describe("faculty live query (public.faculty_directory)", () => {
  const env = () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
  };

  it("reads faculty_directory with named columns, published rows only", async () => {
    env();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ record_id: "rec-42", full_name: "Prof. Real Name", college_unit: "College of ICT", college_code: "CICT", department: "Computing", position_title: "Instructor I" }] });
    vi.stubGlobal("fetch", fetchMock);
    const { searchFaculty } = await load();
    const r = await searchFaculty("real");
    const url = decodeURIComponent(fetchMock.mock.calls[0][0] as string);
    expect(url).toContain("/rest/v1/faculty_directory?select=record_id,full_name,college_unit,college_code,department,position_title&is_published=eq.true&review_status=eq.verified");
    expect(url).toContain("full_name=ilike.*real*");
    expect(url).not.toMatch(/select=\*/);
    expect(url).not.toMatch(/\/rest\/v1\/faculty\?/);
    expect(r.mode).toBe("live");
    expect(r.data[0]).toMatchObject({ id: "rec-42", fullName: "Prof. Real Name", collegeUnit: "College of ICT", collegeCode: "CICT", department: "Computing", positionTitle: "Instructor I", isDemo: false });
    expect(r.data[0].office).toBeUndefined(); // no office column known: card says "Office location unconfirmed"
  });

  it("a failed request rejects: no demo faculty in live mode", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { searchFaculty } = await load();
    await expect(searchFaculty("")).rejects.toThrow(/404/);
  });
});

describe("processes and campus paths live queries", () => {
  const env = () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
  };

  it("processes: published + verified only, steps and requirements ordered by position", async () => {
    env();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [{
      id: "proc-x", name: "Enrollment", summary: null, before_you_start: null,
      process_requirements: [{ position: 2, kind: "document", text: "B" }, { position: 1, kind: "document", text: "A" }],
      process_steps: [{ position: 2, office_place_id: null, title: "Cashier", action: "Pay" }, { position: 1, office_place_id: "office-reg", title: "Registrar", action: "Submit" }],
    }] });
    vi.stubGlobal("fetch", fetchMock);
    const { listProcesses } = await load();
    const r = await listProcesses("");
    const url = decodeURIComponent(fetchMock.mock.calls[0][0] as string);
    expect(url).toContain("/rest/v1/processes?select=id,name,summary,before_you_start,process_requirements(");
    expect(url).toContain("is_published=eq.true&status=eq.verified");
    expect(r.data[0].requirements.map((x) => x.text)).toEqual(["A", "B"]);
    expect(r.data[0].steps.map((x) => x.title)).toEqual(["Registrar", "Cashier"]);
    expect(r.data[0].steps[1].officePlaceId).toBeUndefined();
  });

  it("campus paths: every table filtered to verified rows", async () => {
    env();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const { getCampusPaths } = await load();
    await getCampusPaths();
    const urls = fetchMock.mock.calls.map((c) => decodeURIComponent(c[0] as string));
    for (const t of ["entrances", "walk_nodes", "walk_edges", "floor_plans"]) {
      expect(urls.find((u) => u.includes(`/rest/v1/${t}?`))).toContain("status=eq.verified");
    }
  });

  it("a missing table (404) rejects so the UI can show Retry", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { listProcesses } = await load();
    await expect(listProcesses("")).rejects.toThrow(/404/);
  });
});

describe("building card data (map polygon → verified place)", () => {
  const env = () => { vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key"); };
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  it("live: looks up the verified link by every polygon ID, then the verified building, rooms, offices and plans", async () => {
    env();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("building_features?select=place_id")) return ok([{ place_id: "bldg-lib" }]);
      if (url.includes("building_features?select=feature_id")) return ok([{ feature_id: 21 }]);
      if (url.includes("places?select=*&id=eq.bldg-lib")) return ok([{ id: "bldg-lib", kind: "building", name: "Library", status: "verified", description: "Main library", photo_url: null }]);
      if (url.includes("parent_id=eq.bldg-lib")) return ok([
        { id: "r2", kind: "room", name: "Room L2", room_code: "L2", floor: 2, status: "verified" },
        { id: "o1", kind: "office", name: "Circulation", floor: 1, status: "verified" },
      ]);
      if (url.includes("floor_plans")) return ok([{ id: "fp", building_id: "bldg-lib", floor: 3, label: null, image_url: "https://x/plan.png" }]);
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getBuilding } = await load();
    const r = await getBuilding({ featureIds: [33, 21] });
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls[0]).toContain("building_features?select=place_id&feature_id=in.(33,21)&status=eq.verified");
    for (const u of urls) expect(u).toContain("status=eq.verified");
    expect(r.data?.description).toBe("Main library");
    expect(r.data?.photoUrl).toBeUndefined();
    expect(r.data?.offices.map((o) => o.name)).toEqual(["Circulation"]);
    expect(r.data?.rooms.map((o) => o.roomCode)).toEqual(["L2"]);
    expect(r.data?.floors).toEqual([1, 2, 3]);
    expect(r.data?.featureIds).toEqual([21]);
  });

  it("live: no verified link → null (the card still opens with the map name)", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok([])));
    const { getBuilding } = await load();
    expect((await getBuilding({ featureIds: [20] })).data).toBeNull();
  });

  it("live: table not created yet (404) → null, but a server error still rejects so the card shows Retry", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    let m = await load();
    expect((await m.getBuilding({ featureIds: [20] })).data).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    m = await load();
    await expect(m.getBuilding({ featureIds: [20] })).rejects.toThrow();
  });

  it("demo: the Library polygon links to the DEMO library record; Rizal Hall has none", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const { getBuilding } = await load();
    const lib = await getBuilding({ featureIds: [21] });
    expect(lib.mode).toBe("demo");
    expect(lib.data?.place.id).toBe("bldg-demo-library");
    expect(lib.data?.floorPlans.map((f) => f.id)).toEqual(["fp-demo-lib-1"]);
    expect((await getBuilding({ featureIds: [20] })).data).toBeNull();
    expect((await getBuilding({ placeId: "bldg-demo-library" })).data?.featureIds).toEqual([21]);
  });
});

describe("floor plan image URLs", () => {
  it("full URLs and /demo/ paths are kept; a Storage path resolves against the project's public Storage URL", async () => {
    const { storageUrl } = await import("./live");
    expect(storageUrl("https://cdn.example.org/a.png")).toBe("https://cdn.example.org/a.png");
    expect(storageUrl("/demo/floorplan-cict-2.svg")).toBe("/demo/floorplan-cict-2.svg");
    expect(storageUrl("floor-plans/quezon-hall-floor-1.png")).toMatch(/\/storage\/v1\/object\/public\/floor-plans\/quezon-hall-floor-1\.png$/);
  });
});
