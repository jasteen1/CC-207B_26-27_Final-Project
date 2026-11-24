// Main Gate → Quezon Hall → QH 1 in LIVE mode against the LOCAL rehearsal records
// (mobile/test/fixtures/local-quezon-hall.json, shared with the Flutter tests), answered by a small fake
// of Supabase REST. Only GPS and the MapTiler outline download are mocked.
// The "surveyed" route below is SYNTHETIC (a straight line gate → Quezon Hall), shaped like
// scripts/route_survey_to_sql.py output. It is test data only, never survey data.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import local from "../../../mobile/test/fixtures/local-quezon-hall.json";
import park from "../../../mobile/test/fixtures/outline-wellness-park.json";
import { distanceToBuildingM, parseBuildings, type Building } from "./buildings";
import { distanceM } from "../../lib/routing/graph";
import type { LocationOutcome } from "../../lib/location";

type Rows = Record<string, Record<string, unknown>[]>;
type Fixture = typeof local & Rows;

let gps: LocationOutcome = { ok: false, reason: "unavailable" };
vi.mock("../../lib/location", async (orig) => ({ ...(await orig<typeof import("../../lib/location")>()), getLocation: async () => gps }));
vi.mock("./buildings", async (orig) => {
  const real = await orig<typeof import("./buildings")>();
  const fx = (await import("../../../mobile/test/fixtures/local-quezon-hall.json")).default;
  // Tests that need the integrated outlines around Quezon Hall add them here (see withPark).
  const extra = () => ((globalThis as { __extraOutlines?: unknown[] }).__extraOutlines ?? []);
  return { ...real, campusBuildingsOnce: async () => real.parseBuildings({ features: [...fx.features.features, ...extra()] } as Parameters<typeof real.parseBuildings>[0]) };
});

const shapes: Building[] = parseBuildings(local.features as Parameters<typeof parseBuildings>[0]);
const shape = (name: string) => shapes.find((b) => b.name === name)!;
function centroid(name: string) {
  const ring = shape(name).polygons[0][0];
  return { lng: ring.reduce((a, p) => a + p[0], 0) / ring.length, lat: ring.reduce((a, p) => a + p[1], 0) / ring.length };
}
const fixAt = (name: string, accuracy: number): LocationOutcome => ({ ok: true, fix: { ...centroid(name), accuracy } });

/** Just enough PostgREST: eq / in / ilike / or filters, limit, and the `parent:parent_id(*)` embed. */
function fakeRest(db: Rows) {
  return vi.fn(async (input: string) => {
    const u = new URL(input);
    const table = u.pathname.split("/").pop()!;
    const rows = db[table];
    if (!rows) return { ok: false, status: 404, json: async () => ({}) };
    const test = (r: Record<string, unknown>, col: string, opv: string) => {
      const i = opv.indexOf("."), op = opv.slice(0, i), v = opv.slice(i + 1), x = r[col] == null ? undefined : String(r[col]);
      if (op === "eq") return x === v;
      if (op === "in") return v.replace(/^\(|\)$/g, "").split(",").includes(x ?? "");
      if (op === "ilike") return x !== undefined && new RegExp(`^${v.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i").test(x);
      throw new Error(`op ${op}`);
    };
    let out = rows.filter((r) => [...u.searchParams].every(([k, v]) => {
      if (["select", "order", "limit"].includes(k)) return true;
      if (k === "or") return v.replace(/^\(|\)$/g, "").split(",").some((p) => { const d = p.indexOf("."); return test(r, p.slice(0, d), p.slice(d + 1)); });
      return test(r, k, v);
    })).map((r) => ({ ...r }));
    if ((u.searchParams.get("select") ?? "").includes("parent:parent_id(")) {
      for (const r of out) r.parent = db.places.find((p) => p.id === r.parent_id) ?? null;
    }
    const limit = Number(u.searchParams.get("limit") ?? NaN);
    if (Number.isFinite(limit)) out = out.slice(0, limit);
    return { ok: true, status: 200, json: async () => out };
  });
}

/** The local fixture plus a SYNTHETIC verified gate → Quezon Hall route (importer row shapes and IDs). */
function surveyed(): Rows {
  const gate = centroid("Entrance (Main Gate)"), qh = centroid("Quezon Hall");
  const at = (t: number) => ({ lng: gate.lng + (qh.lng - gate.lng) * t, lat: gate.lat + (qh.lat - gate.lat) * t });
  let door = 1;
  for (let t = 0.5; t <= 1; t += 0.005) { if (distanceToBuildingM(shape("Quezon Hall"), at(t).lng, at(t).lat) < 2) break; door = t; }
  const pts: [string, { lng: number; lat: number }][] = [["gate-main", at(0)], ["j-1", at(door / 3)], ["j-2", at((door * 2) / 3)], ["qh-entrance-main", at(door)]];
  const db = local as unknown as Rows;
  return {
    ...db,
    places: [...db.places, { id: "landmark-entrance-main-gate", kind: "landmark", name: "Entrance (Main Gate)", short_name: null, room_code: null, room_label: null, floor: null, parent_id: null, ...gate, status: "verified" }],
    building_features: [...db.building_features, { feature_id: 41, place_id: "landmark-entrance-main-gate", status: "verified" }],
    walk_nodes: pts.map(([id, p]) => ({ id: `n-${id}`, ...p, status: "verified" })),
    walk_edges: pts.slice(1).map(([id, p], i) => ({ id: `w-${pts[i][0]}--${id}`, from_node: `n-${pts[i][0]}`, to_node: `n-${id}`, length_m: distanceM(pts[i][1], p), status: "verified" })),
    entrances: [
      { id: "ent-qh-entrance-main", building_id: "bldg-quezon-hall", name: "Quezon Hall main entrance", ...pts[3][1], node_id: "n-qh-entrance-main", status: "verified" },
      { id: "ent-gate-main", building_id: "landmark-entrance-main-gate", name: "Main Gate (inside the gate)", ...gate, node_id: "n-gate-main", status: "verified" },
    ],
  };
}

let renderApp: typeof import("../../test-utils").renderApp;
async function open(url: string, db: Rows = local as unknown as Fixture, location: LocationOutcome = { ok: false, reason: "unavailable" }) {
  gps = location;
  vi.stubGlobal("fetch", fakeRest(db));
  const loc = renderApp(url);
  await screen.findByRole("article", { name: "Inside the building" });
  return loc;
}
beforeEach(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://local.test");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "sb_publishable_test");
  vi.resetModules(); // fresh live config and request cache for each data set
  ({ renderApp } = await import("../../test-utils"));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); delete (globalThis as { __extraOutlines?: unknown[] }).__extraOutlines; });
/** The integrated outlines: the fixture's plus Wellness Park (an open park with no place record yet). */
const withPark = () => { (globalThis as { __extraOutlines?: unknown[] }).__extraOutlines = park.features; };

const QH1 = "/map?to=room-quezon-hall-f1-qh1";
const AT_QH = "You’re at Quezon Hall. Go straight to the floor plan.";
const ASK = "Your location (±30 m) could be Quezon Hall or Hometel. Are you at Quezon Hall?";
const directions = () => screen.getByRole("article", { name: "Directions" });
const startLine = () => directions().querySelector(".start-line")!.textContent;

async function expectQh1Selected() {
  expect(within(screen.getByRole("article", { name: "Destination" })).getByRole("heading", { name: "Quezon Hall" })).toBeInTheDocument();
  const inside = screen.getByRole("article", { name: "Inside the building" });
  expect(within(inside).getByText("QH 1", { selector: "dd" })).toBeInTheDocument();
  expect(within(inside).getByText("1", { selector: "dd" })).toBeInTheDocument();
  expect(await within(inside).findByRole("img", { name: "QH 1 highlighted on the floor plan" })).toBeInTheDocument();
}
async function pickStart(name: RegExp) {
  await userEvent.click(screen.getByRole("button", { name: "Choose starting point" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name }));
}

describe("accuracy circle geometry (local outlines)", () => {
  it("Hometel is within 30 m of Quezon Hall's middle, not within 8 m", () => {
    const qh = centroid("Quezon Hall");
    expect(distanceToBuildingM(shape("Quezon Hall"), qh.lng, qh.lat)).toBe(0);
    const gap = distanceToBuildingM(shape("Hometel"), qh.lng, qh.lat);
    expect(gap).toBeGreaterThan(8);
    expect(gap).toBeLessThan(30);
  });
});

describe("arriving at Quezon Hall with GPS (QH 1 destination)", () => {
  it("±30 m covering Quezon Hall and Hometel asks; “I’m at Quezon Hall” goes to the floor plan", async () => {
    const loc = await open(QH1, undefined, fixAt("Quezon Hall", 30));
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await within(directions()).findByText(ASK)).toBeInTheDocument();
    expect(screen.queryByText(AT_QH)).not.toBeInTheDocument();
    expect(screen.queryByText("Indoor step")).not.toBeInTheDocument();
    await expectQh1Selected();

    await userEvent.click(within(directions()).getByRole("button", { name: "I’m at Quezon Hall" }));
    expect(loc.current).toBe(`${QH1}&from=bldg-quezon-hall`);
    expect(await screen.findByText("You’re already in this building. Go straight to the floor plan.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Confirm where you are" })).not.toBeInTheDocument();
    expect(screen.getByText("Indoor step")).toBeInTheDocument();
    await expectQh1Selected();
  });

  it("“I’m at Hometel” makes Hometel the start; the walk is still needed", async () => {
    const loc = await open(QH1, undefined, fixAt("Quezon Hall", 30));
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await userEvent.click(await within(directions()).findByRole("button", { name: "I’m at Hometel" }));
    expect(loc.current).toBe(`${QH1}&from=bldg-hometel`);
    expect(await within(directions()).findByText("No verified entrance is recorded for Quezon Hall yet, so walking directions are unavailable.")).toBeInTheDocument();
    expect(startLine()).toBe("Hometel");
    expect(screen.queryByText(AT_QH)).not.toBeInTheDocument();
    await expectQh1Selected();
  });

  it("“Somewhere else” opens the picker; Main Gate is chosen; QH 1 stays", async () => {
    const loc = await open(QH1, undefined, fixAt("Quezon Hall", 30));
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await userEvent.click(await within(directions()).findByRole("button", { name: "Somewhere else" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Entrance \(Main Gate\)/ }));
    expect(loc.current).toBe(`${QH1}&from=map%3A41`);
    expect(await within(directions()).findByText(/\(map only\)/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Confirm where you are" })).not.toBeInTheDocument();
    await expectQh1Selected();
  });

  it("±8 m covering only Quezon Hall keeps the arrival behaviour: straight to the floor plan, no question", async () => {
    await open(QH1, undefined, fixAt("Quezon Hall", 8));
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await within(directions()).findByText(AT_QH)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Confirm where you are" })).not.toBeInTheDocument();
    await expectQh1Selected();
  });

  it("poor GPS (±80 m) inside Quezon Hall neither asks nor skips", async () => {
    await open(QH1, undefined, fixAt("Quezon Hall", 80));
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await within(directions()).findByText(/GPS accuracy is poor/)).toBeInTheDocument();
    expect(screen.queryByText(AT_QH)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Confirm where you are" })).not.toBeInTheDocument();
  });
});

describe("Main Gate chosen by hand", () => {
  it("route not surveyed: the gate stays map-only and the route is reported as unsurveyed", async () => {
    await open(QH1);
    await pickStart(/^Entrance \(Main Gate\)/);
    expect(await within(directions()).findByText("No verified entrance is recorded for Quezon Hall yet, so walking directions are unavailable.")).toBeInTheDocument();
    expect(startLine()).toContain("(map only)");
    expect(within(directions()).queryByText(/min$/)).not.toBeInTheDocument();
    await expectQh1Selected();
  });

  it("verified test route and entrance: the gate resolves as a landmark and the student gets a walking route", async () => {
    await open(QH1, surveyed());
    await pickStart(/^Entrance \(Main Gate\)/);
    expect(await within(directions()).findByText(/min$/)).toBeInTheDocument();
    expect(startLine()).toBe("Entrance (Main Gate)");
    expect(within(screen.getByRole("article", { name: "Destination" })).getByText("Quezon Hall main entrance")).toBeInTheDocument();
    await expectQh1Selected();
  });

  it("GPS denied, then the gate by hand on the surveyed route: route, QH 1 kept, notice cleared", async () => {
    await open(QH1, surveyed(), { ok: false, reason: "denied" });
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await within(directions()).findByText(/You didn’t allow location access/)).toBeInTheDocument();
    await pickStart(/^Entrance \(Main Gate\)/);
    expect(await within(directions()).findByText(/min$/)).toBeInTheDocument();
    expect(within(directions()).queryByText(/You didn’t allow location access/)).not.toBeInTheDocument();
    await expectQh1Selected();
  });
});

describe("integrated outlines: Wellness Park (open park, no record) sits between Quezon Hall and Hometel", () => {
  const parkShape = parseBuildings(park as Parameters<typeof parseBuildings>[0])[0];
  const confirmButtons = () => within(screen.getByRole("group", { name: "Confirm where you are" })).getAllByRole("button").map((b) => b.textContent);

  it("geometry: a ±30 m circle at Quezon Hall reaches Wellness Park (~24 m) and Hometel (~28 m)", () => {
    const qh = centroid("Quezon Hall");
    expect(distanceToBuildingM(parkShape, qh.lng, qh.lat)).toBeLessThan(distanceToBuildingM(shape("Hometel"), qh.lng, qh.lat));
    expect(distanceToBuildingM(parkShape, qh.lng, qh.lat)).toBeLessThan(30);
  });

  it("±30 m: the question names only places with a button; Hometel stays selectable; QH 1 stays highlighted", async () => {
    withPark();
    const loc = await open(QH1, undefined, fixAt("Quezon Hall", 30));
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await within(directions()).findByText(ASK)).toBeInTheDocument();
    expect(within(directions()).queryByText(/Wellness Park/)).not.toBeInTheDocument();
    expect(confirmButtons()).toEqual(["I’m at Quezon Hall", "I’m at Hometel", "Somewhere else"]);
    await userEvent.click(within(directions()).getByRole("button", { name: "I’m at Hometel" }));
    expect(loc.current).toBe(`${QH1}&from=bldg-hometel`);
    expect(startLine()).toBe("Hometel");
    await expectQh1Selected();
  });

  it("“Somewhere else” still offers Wellness Park as a campus-map place; choosing it keeps QH 1", async () => {
    withPark();
    const loc = await open(QH1, undefined, fixAt("Quezon Hall", 30));
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await userEvent.click(await within(directions()).findByRole("button", { name: "Somewhere else" }));
    const mapList = within(screen.getByRole("dialog")).getByRole("list", { name: "Buildings on the campus map" });
    await userEvent.click(within(mapList).getByRole("button", { name: /^Wellness Park/ }));
    expect(loc.current).toBe(`${QH1}&from=map%3A8`);
    expect(await within(directions()).findByText(/\(map only\)/)).toBeInTheDocument();
    expect(startLine()).toContain("Wellness Park");
    await expectQh1Selected();
  });

  it("±25 m: only Quezon Hall and the park are reached, so the question names no other place and asks", async () => {
    withPark();
    await open(QH1, undefined, fixAt("Quezon Hall", 25));
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await within(directions()).findByText("Your location (±25 m) could be Quezon Hall or somewhere nearby. Are you at Quezon Hall?")).toBeInTheDocument();
    expect(screen.queryByText(AT_QH)).not.toBeInTheDocument();
    expect(confirmButtons()).toEqual(["I’m at Quezon Hall", "Somewhere else"]);
    await expectQh1Selected();
  });
});
