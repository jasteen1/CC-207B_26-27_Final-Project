// Regression: the live search for a published room (QH 1) failed. On this self-referencing table
// PostgREST answers `parent:places!parent_id(*)` with the row's CHILDREN (a list), not its parent.
// The app must ask with `parent:parent_id(*)` and ignore a list. The fake answers like real PostgREST.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

const building = { id: "bldg-quezon-hall", kind: "building", name: "Quezon Hall", short_name: null, room_code: null, floor: null, parent_id: null, lng: 122.562676, lat: 10.71313, status: "verified", source: null };
const room = { id: "room-quezon-hall-f1-qh1", kind: "room", name: "QH 1", short_name: null, room_code: "QH1", floor: 1, parent_id: "bldg-quezon-hall", lng: null, lat: null, status: "verified", source: null };

async function load(answer?: (select: string) => unknown[]) {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
  const selects: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (u: string) => {
    const select = new URL(u).searchParams.get("select") ?? "";
    selects.push(select);
    const rows = (answer ?? ((s: string) => [room].map((r) => ({
      ...r,
      ...(s.includes("parent:parent_id(") ? { parent: r.parent_id === building.id ? building : null } : {}),
      ...(s.includes("parent:places!parent_id(") ? { parent: [] } : {}),
    }))))(select);
    return { ok: true, status: 200, json: async () => rows };
  }));
  vi.resetModules();
  return { live: await import("./live"), selects };
}

describe("live places: parent building embed", () => {
  it("search QH 1 asks with parent:parent_id(*) and gets Quezon Hall as the parent", async () => {
    const { live, selects } = await load();
    const [hit] = await live.liveSearch("QH 1");
    expect(selects[0]).toBe("*,parent:parent_id(*)");
    expect(hit.place.roomCode).toBe("QH1");
    expect(hit.parent?.name).toBe("Quezon Hall");
  });

  it("a list in parent (the old embed shape) is ignored instead of breaking the result", async () => {
    const { live } = await load(() => [{ ...room, parent: [] }]);
    const [hit] = await live.liveSearch("QH 1");
    expect(hit.place.name).toBe("QH 1");
    expect(hit.parent).toBeUndefined();
  });
});
