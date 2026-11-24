import sample from "./wayfinder-sample.json";
import { buildingAt, buildingKey, buildingName, buildingOfFeature, CAMPUS_DATASET_ID, findBuilding, loadCampusDataset, panToReveal, parseBuildings, styleCopiesOfDataset } from "./buildings";

const list = parseBuildings(sample as Parameters<typeof parseBuildings>[0]);
const centroid = (name: string) => {
  const ring = (sample.features.find((f) => f.properties.name === name)!.geometry.coordinates as number[][][])[0];
  return [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length] as const;
};

describe("campus building polygons (real Wayfinder dataset excerpt)", () => {
  it("every drawn polygon is tappable (gates too), a building drawn as two polygons is one, keyed by place_id", () => {
    expect(list.map((b) => b.name).sort()).toEqual(["CICT Building", "College of Communication", "Entrance (Main Gate)", "Library", "ROTC Office & Alumni Building", "Rizal Hall"]);
    expect(findBuilding(list, "map:20")?.name).toBe("Rizal Hall");
    expect(findBuilding(list, "map:21")?.name).toBe("Library");
    const coc = list.find((b) => b.name === "College of Communication")!;
    expect(coc.featureIds).toEqual([33, 34]);
    expect(coc.key).toBe("map:33");
    expect(coc.polygons).toHaveLength(2);
  });

  it("a polygon without place_id still gets a stable key from its feature id", () => {
    const rotc = list.find((b) => b.name.startsWith("ROTC"))!;
    expect(rotc.featureIds).toEqual([]);
    expect(rotc.key).toMatch(/^map:f:[0-9a-f-]{36}$/);
  });

  it("prefers name:en, falls back to name, trims dataset spaces", () => {
    expect(buildingName({ name: "Bulwagan Rizal", "name:en": "Rizal Hall" })).toBe("Rizal Hall");
    expect(buildingName({ name: "Parking Lot " })).toBe("Parking Lot");
    expect(buildingName({ "name:en": " ", name: "Library" })).toBe("Library");
    expect(buildingKey({ place_id: "21" })).toBe("map:21");
  });

  it("a tap inside Rizal Hall finds Rizal Hall, inside the Library finds the Library (neighbours)", () => {
    expect(buildingAt(list, ...centroid("Rizal Hall"))?.name).toBe("Rizal Hall");
    expect(buildingAt(list, ...centroid("Library"))?.name).toBe("Library");
    expect(buildingAt(list, 122.5, 10.7)).toBeUndefined();
  });

  it("ignores non-polygon features (the dataset also has a line)", () => {
    const withLine = { features: [...sample.features, { properties: { name: "Path" }, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }] };
    expect(parseBuildings(withLine as Parameters<typeof parseBuildings>[0]).some((b) => b.name === "Path")).toBe(false);
  });

  it("either wing of a two-polygon building selects the same building", () => {
    expect(buildingOfFeature(list, { name: "College of Communication", place_id: 34 })?.key).toBe("map:33");
  });
});

describe("panToReveal: move the map just enough to clear the card", () => {
  const view = { width: 400, height: 600 };
  it("no move when the building is already clear of the card", () => {
    expect(panToReveal({ left: 100, top: 100, right: 200, bottom: 200 }, view, { bottom: 250 })).toEqual([0, 0]);
  });
  it("hidden under the phone sheet: pans up only by the overlap plus a margin", () => {
    expect(panToReveal({ left: 100, top: 300, right: 200, bottom: 420 }, view, { bottom: 250 })).toEqual([0, 86]);
  });
  it("off the left edge: pans sideways", () => {
    expect(panToReveal({ left: -40, top: 100, right: 60, bottom: 200 }, view, {})).toEqual([-56, 0]);
  });
  it("bigger than the free area: centres it", () => {
    expect(panToReveal({ left: 100, top: 0, right: 200, bottom: 500 }, view, { bottom: 250 })).toEqual([0, 75]);
  });
});

describe("loading the dataset straight from MapTiler Data", () => {
  it("fetches the dataset endpoint with the key appended, revalidating every time", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }));
    const fc = await loadCampusDataset("k&y", fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(`https://api.maptiler.com/data/${CAMPUS_DATASET_ID}/features.json?key=k%26y`, { cache: "no-cache" });
    expect(parseBuildings(fc).map((b) => b.name)).toEqual(list.map((b) => b.name));
  });

  it("returns null without a key, on a rejected key, a network error or a malformed body", async () => {
    const never = vi.fn();
    expect(await loadCampusDataset("", never as unknown as typeof fetch)).toBeNull();
    expect(never).not.toHaveBeenCalled();
    expect(await loadCampusDataset("k", (async () => new Response("no", { status: 403 })) as unknown as typeof fetch)).toBeNull();
    expect(await loadCampusDataset("k", (async () => { throw new TypeError("offline"); }) as unknown as typeof fetch)).toBeNull();
    expect(await loadCampusDataset("k", (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch)).toBeNull();
  });

  it("finds the custom style's own copy of the dataset (layers + source) and nothing else", () => {
    const style = {
      sources: {
        maptiler_planet_v4: { type: "vector", url: "https://api.maptiler.com/tiles/v4/tiles.json" },
        [CAMPUS_DATASET_ID]: { type: "geojson", data: `https://api.maptiler.com/data/${CAMPUS_DATASET_ID}/features.json?key=x` },
        renamed: { type: "geojson", data: `https://api.maptiler.com/data/${CAMPUS_DATASET_ID}/features.json` },
      },
      layers: [
        { id: "background" },
        { id: "building", source: "maptiler_planet_v4" },
        { id: "Wayfinder", source: CAMPUS_DATASET_ID },
        { id: "Wayfinder copy 1", source: CAMPUS_DATASET_ID },
        { id: "other copy", source: "renamed" },
      ],
    };
    expect(styleCopiesOfDataset(style)).toEqual({ sources: [CAMPUS_DATASET_ID, "renamed"], layers: ["Wayfinder", "Wayfinder copy 1", "other copy"] });
  });
});
