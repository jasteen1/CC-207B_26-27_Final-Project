// Search behaviour with what the LIVE database has today: no place records, only the map polygons
// (names copied from the live MapTiler dataset) and the team's room-code prefixes.
import { parseRoomCode, roomDisplay } from "../search";
import { prefixPointer, resolveSearch, ROOM_PREFIXES, type MapBuildingRef } from "./resolve";

const live = (pairs: [number, string][]): MapBuildingRef[] => pairs.map(([id, name]) => ({ key: `map:${id}`, name, featureIds: [id] }));
const map = live([[1, "New Academic Building"], [2, "College of Education"], [10, "Quezon Hall"], [14, "College of Dentistry"], [15, "College of Business and Management"],
  [17, "CTE"], [19, "CICT Building"], [22, "College of Nursing"], [31, "Administration"], [34, "College of Communication"], [38, "College of Medicine (Roxas Hall)"],
  [39, "PSFW Building / College of Medicine (Annex 1)"], [13, "Supply Office"]]);

describe("room codes", () => {
  it("ICT 201, ICT-201 and ict201 are the same search; the typed label is kept for display", () => {
    for (const q of ["ICT 201", "ICT-201", "ict201", "  ict 201 "]) expect(parseRoomCode(q)).toEqual({ code: "ICT201", prefix: "ICT", number: "201" });
    expect(parseRoomCode("ICT 104-A")).toEqual({ code: "ICT104A", prefix: "ICT", number: "104A" });
    expect(parseRoomCode("Library")).toBeNull();
    expect(roomDisplay({ roomLabel: "ICT 201", roomCode: "ICT201", name: "Room" })).toBe("ICT 201");
    expect(roomDisplay({ roomCode: "CB203", name: "Room" })).toBe("CB203");
  });

  it("no record: ICT points to CICT Building, room not confirmed, no floor", () => {
    for (const q of ["ICT 201", "ICT-201", "ict201"]) {
      const [hit, ...rest] = resolveSearch(q, [], map);
      expect(rest).toEqual([]);
      expect(hit).toMatchObject({ kind: "prefix", label: "ICT 201", building: { key: "map:19" }, message: "ICT points to CICT Building. Room 201 hasn’t been confirmed yet." });
      expect(JSON.stringify(hit)).not.toMatch(/floor/i);
    }
  });

  it("every supplied prefix resolves to the building it was matched to; EB (PESCAR) is not on the map", () => {
    const expected: Record<string, string | null> = { ICT: "CICT Building", RB: "College of Business and Management", EB: null, NAB: "New Academic Building",
      MC: "College of Communication", QH: "Quezon Hall", NB: "College of Nursing", AB: "College of Dentistry", RH: "College of Medicine (Roxas Hall)" };
    expect(ROOM_PREFIXES.map((p) => p.prefix).sort()).toEqual(Object.keys(expected).sort());
    for (const [prefix, name] of Object.entries(expected)) {
      const hit = prefixPointer(`${prefix} 101`, map);
      if (name) expect(hit).toMatchObject({ kind: "prefix", building: { name } });
      else expect(hit).toMatchObject({ kind: "prefix-unmapped", message: "EB is listed as College of PESCAR, which isn’t on the campus map yet. Room 101 hasn’t been confirmed yet." });
    }
  });

  it("map unavailable (offline / no key): still says where ICT points, without claiming it isn't mapped", () => {
    expect(prefixPointer("ICT 201", [])).toMatchObject({ kind: "prefix", building: undefined, message: "ICT points to CICT Building. Room 201 hasn’t been confirmed yet." });
  });

  it("an unknown prefix finds nothing instead of guessing", () => {
    expect(resolveSearch("ZZ 404", [], map)).toEqual([]);
  });
});

describe("office and building names", () => {
  it("Administration: the mapped building, which doesn't confirm any office inside it", () => {
    expect(resolveSearch("Administration", [], map)).toEqual([
      { kind: "mapped", building: { key: "map:31", name: "Administration", featureIds: [31] }, note: "Building on the campus map. No office inside it has been confirmed yet." },
    ]);
  });

  it("College of Education: its building, plus NAB as an association that is not an office location", () => {
    const hits = resolveSearch("College of Education", [], map);
    expect(hits.map((h) => (h.kind === "mapped" ? h.building.name : h.kind))).toEqual(["College of Education", "New Academic Building"]);
    expect(hits[1]).toMatchObject({ note: "Associated with College of Education (room prefix NAB). This is not a confirmed office location." });
  });

  it("College of Medicine finds Roxas Hall and the annex by name; Supply Office finds its building", () => {
    expect(resolveSearch("college of medicine", [], map).map((h) => h.kind === "mapped" && h.building.key)).toEqual(["map:38", "map:39"]);
    expect(resolveSearch("Supply Office", [], map).map((h) => h.kind === "mapped" && h.building.key)).toEqual(["map:13"]);
  });
});
