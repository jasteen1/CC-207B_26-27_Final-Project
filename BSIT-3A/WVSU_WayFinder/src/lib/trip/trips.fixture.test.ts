// Runs the 50 shared sample trips (src/data/fixtures/trips) through search → destination → trip plan.
// The Flutter suite runs the same file (mobile/test/trips_fixture_test.dart); both must agree.
import campusFile from "../../data/fixtures/trips/campus.fixture.json";
import tripsFile from "../../data/fixtures/trips/trips.fixture.json";
import { resolveSearch, type MapBuildingRef, type SearchHit } from "../campus/resolve";
import { parseRoomCode } from "../search";
import type { CampusPaths, Place, PlaceView } from "../types";
import { planTrip, type TripDest, type TripStart } from "./plan";

const places = campusFile.places as Place[];
const byId = new Map(places.map((p) => [p.id, p]));
const view = (p: Place): PlaceView => ({ place: p, parent: p.parentId ? byId.get(p.parentId) : undefined });
const map = campusFile.mapBuildings as MapBuildingRef[];
const links = new Map(campusFile.links.map((l) => [l.featureId, l.placeId]));
const campus = campusFile.campus as unknown as CampusPaths;

/** Same matching as the app's record search (demo.ts / live.ts). */
function recordSearch(q: string): PlaceView[] {
  const code = parseRoomCode(q);
  if (code) return places.filter((p) => p.roomCode === code.code).map(view);
  const n = q.trim().toLowerCase();
  return places.filter((p) => p.name.toLowerCase().includes(n) || p.shortName?.toLowerCase() === n).map(view);
}
const hitKey = (h: SearchHit) => (h.kind === "place" ? `place:${h.view.place.id}` : h.kind === "mapped" ? `mapped:${h.building.key}` : `${h.kind}:${h.prefix}`);
/** A map polygon opens its linked record when there is one, else stays a map-only destination. */
const destOfBuilding = (b: MapBuildingRef): TripDest => {
  const linked = b.featureIds.map((id) => links.get(id)).find(Boolean);
  return linked ? { kind: "place", view: view(byId.get(linked)!) } : { kind: "mapped", name: b.name };
};

interface Trip {
  id: string; category: string; query?: string; to?: string; pick?: { place?: string };
  start?: { place?: string; mapped?: string; gps?: { lng: number; lat: number; accuracy: number }; gpsFailure?: string; gpsPending?: boolean };
  expect: Record<string, unknown> & { hitNote?: Record<string, string> };
}
const trips = tripsFile.trips as Trip[];

function startOf(t: Trip): TripStart {
  const s = t.start;
  if (!s) return { kind: "none" };
  if (s.place) return { kind: "place", view: view(byId.get(s.place)!) };
  if (s.mapped) return { kind: "mapped", name: s.mapped };
  if (s.gps) return { kind: "gps", fix: s.gps };
  if (s.gpsFailure) return { kind: "gps", fix: null, failure: s.gpsFailure as never };
  return { kind: "gps", fix: null };
}

describe("50 shared sample trips", () => {
  it("has 50 trips covering every required category", () => {
    expect(trips).toHaveLength(50);
    expect(new Set(trips.map((t) => t.id)).size).toBe(50);
    expect(new Set(trips.map((t) => t.category))).toEqual(new Set(["building-to-building", "classroom-code", "office", "same-building", "gps", "missing-path"]));
  });

  it.each(trips.map((t) => [t.id, t] as const))("%s", (_id, t) => {
    const e = t.expect;
    let dest: TripDest | null = null;
    if (t.query !== undefined) {
      const hits = resolveSearch(t.query, recordSearch(t.query), map);
      const keys = hits.map(hitKey);
      for (const k of (e.alsoHits as string[] | undefined) ?? []) expect(keys).toContain(k);
      for (const k of (e.notHits as string[] | undefined) ?? []) expect(keys).not.toContain(k);
      for (const [k, note] of Object.entries(e.hitNote ?? {})) {
        const h = hits.find((x) => hitKey(x) === k);
        expect(h && h.kind === "mapped" ? h.note : undefined).toContain(note);
      }
      const hit = t.pick?.place ? hits.find((h) => h.kind === "place" && h.view.place.id === t.pick!.place) : hits[0];
      expect(hit?.kind ?? "none").toBe(e.hit);
      if (e.hitMessage) expect(hit && "message" in hit ? hit.message : undefined).toBe(e.hitMessage);
      if (hit?.kind === "place") dest = { kind: "place", view: hit.view };
      else if (hit?.kind === "mapped" || (hit?.kind === "prefix" && hit.building)) dest = destOfBuilding(hit.building!);
    } else if (t.to) {
      dest = { kind: "place", view: view(byId.get(t.to)!) };
    }

    if (e.dest === null) { expect(dest).toBeNull(); return; }
    expect(dest).not.toBeNull();
    if (String(e.dest).startsWith("mapped:")) {
      expect(dest!.kind).toBe("mapped");
      expect(map.find((b) => `mapped:${b.key}` === e.dest)?.name).toBe(dest!.kind === "mapped" ? dest!.name : "");
    } else {
      expect(dest!.kind === "place" ? dest!.view.place.id : null).toBe(e.dest);
    }

    const trip = planTrip(dest!, startOf(t), campus);
    expect(trip.status).toBe(e.status);
    if ("building" in e) expect(trip.destBuilding?.id ?? null).toBe(e.building);
    if ("entrance" in e) expect(trip.entrance?.id ?? null).toBe(e.entrance);
    if (e.path) expect(trip.route?.nodeIds).toEqual(e.path);
    if (e.status === "route") expect(trip.route!.minutes).toBeGreaterThanOrEqual(1);
    else expect(trip.route).toBeUndefined();
    if (e.message) expect(trip.message).toContain(e.message);
    if (e.noIndoor) expect(trip.indoor).toBeUndefined();
    if ("label" in e) expect(trip.indoor?.label).toBe(e.label);
    if ("floor" in e) expect(trip.indoor?.floor ?? null).toBe(e.floor);
    if ("plan" in e) expect(trip.indoor?.plan?.id ?? null).toBe(e.plan);
    if ("spot" in e) expect(trip.indoor?.spot?.label ?? null).toBe(e.spot);
    if (e.note) expect(trip.indoor?.note).toContain(e.note);
    // The highlight never comes from another blueprint than the one opened.
    if (trip.indoor?.spot) expect(trip.indoor.spot.floorPlanId).toBe(trip.indoor.plan?.id);
  });
});
