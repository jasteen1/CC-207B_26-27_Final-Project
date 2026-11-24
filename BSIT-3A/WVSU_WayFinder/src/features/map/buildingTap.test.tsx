// Tap-through of the building card with the map's tap callback driven directly (jsdom has no WebGL).
// Polygons come from a real excerpt of the team's MapTiler dataset; place records are DEMO fixtures.
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test-utils";
import sample from "./wayfinder-sample.json";
import { buildingAt, parseBuildings, type Building } from "./buildings";
import type { BuildingOptions } from "./useMapLibre";

const buildings = parseBuildings(sample as Parameters<typeof parseBuildings>[0]);
const map = vi.hoisted(() => ({ opts: undefined as BuildingOptions | undefined, reveal: vi.fn() }));

vi.mock("./useMapLibre", async (orig) => {
  const real = await orig<typeof import("./useMapLibre")>();
  return {
    ...real,
    useMapLibre: (_c: unknown, _p: unknown, _r: unknown, opts?: BuildingOptions) => {
      map.opts = opts;
      return { basemapFailed: false, mapError: null, buildings, reveal: map.reveal };
    },
  };
});

const centroid = (name: string): [number, number] => {
  const ring = (sample.features.find((f) => f.properties.name === name)!.geometry.coordinates as number[][][])[0];
  return [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];
};
/** What the map does on a tap: find the building under the point, then call onBuildingTap. */
const tapAt = async ([lng, lat]: [number, number]) => {
  const b = buildingAt(buildings, lng, lat) as Building;
  await act(async () => map.opts!.onBuildingTap(b));
};
const tapLabel = async (name: string) => act(async () => map.opts!.onBuildingTap(buildings.find((b) => b.name === name)!));
const card = () => screen.getByTestId("building-card");

describe("tappable campus buildings", () => {
  beforeEach(() => { map.reveal.mockClear(); });

  it("Rizal Hall → Library → close: right name and gold highlight each time; the starting point survives", async () => {
    const loc = renderApp("/map?from=bldg-demo-admin");
    await screen.findByRole("heading", { name: "Campus Map" });

    await tapAt(centroid("Rizal Hall"));
    expect(within(card()).getByRole("heading", { name: "Rizal Hall" })).toBeInTheDocument();
    expect(map.opts!.highlight).toEqual(["Rizal Hall"]);
    expect(loc.current).toBe("/map?from=bldg-demo-admin&sel=map%3A20");
    // No verified record linked: the card still opens and says so.
    await userEvent.click(within(card()).getByRole("button", { name: "Details" }));
    expect(await within(card()).findByText("Building details coming soon.")).toBeInTheDocument();
    expect(within(card()).getByRole("img", { name: "Building photo coming soon" })).toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: /Directions/ })).toBeDisabled();
    expect(map.reveal).toHaveBeenCalledWith(expect.objectContaining({ name: "Rizal Hall" }), expect.anything());

    await tapLabel("Library");
    expect(screen.getAllByTestId("building-card")).toHaveLength(1); // same card, updated
    expect(within(card()).getByRole("heading", { name: "Library" })).toBeInTheDocument();
    expect(map.opts!.highlight).toEqual(["Library"]);
    expect(loc.current).toBe("/map?from=bldg-demo-admin&sel=map%3A21");

    await userEvent.click(within(card()).getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("building-card")).not.toBeInTheDocument();
    expect(map.opts!.highlight).toEqual([]);
    expect(loc.current).toBe("/map?from=bldg-demo-admin");
  });

  it("a linked verified record adds description, floors, offices, rooms and the floor plan (zoomable)", async () => {
    renderApp("/map?sel=map%3A21");
    await screen.findByRole("heading", { name: "Library" });
    await userEvent.click(within(card()).getByRole("button", { name: "Details" }));
    expect(await within(card()).findByText(/DEMO: placeholder description/)).toBeInTheDocument();
    expect(within(card()).getByText("Demo Office of Student Affairs")).toBeInTheDocument();
    expect(within(card()).getByText("LIB1")).toBeInTheDocument();
    expect(within(card()).getByRole("heading", { name: "Floor" }).nextSibling).toHaveTextContent("1");

    await userEvent.click(within(card()).getByRole("button", { name: "View floor plan" }));
    const viewer = screen.getByRole("dialog", { name: /Floor plan: Demo Library floor 1 blueprint/ });
    expect(within(viewer).getByText("100%")).toBeInTheDocument();
    await userEvent.click(within(viewer).getByRole("button", { name: "Zoom in" }));
    expect(within(viewer).getByText("150%")).toBeInTheDocument();
    // Zoom scales the image and its highlight overlay together (one box).
    expect(within(viewer).getByTestId("plan-image")).toHaveStyle({ width: "150%" });
    await userEvent.click(within(viewer).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tapping a building never changes the route; Directions does, and keeps the start", async () => {
    const loc = renderApp("/map?to=room-demo-cb-203&from=bldg-demo-admin");
    await screen.findByRole("article", { name: "Destination" });
    await tapLabel("Library");
    expect(loc.current).toBe("/map?to=room-demo-cb-203&from=bldg-demo-admin&sel=map%3A21");
    expect(within(screen.getByRole("article", { name: "Destination" })).getByText("Demo College Building")).toBeInTheDocument();

    const directions = within(card()).getByRole("button", { name: /Directions/ });
    await vi.waitFor(() => expect(directions).toBeEnabled());
    await userEvent.click(directions);
    expect(loc.current).toBe("/map?to=bldg-demo-library&from=bldg-demo-admin");
    expect(screen.queryByTestId("building-card")).not.toBeInTheDocument();
  });

  it("the sheet's drag handle expands and collapses the details", async () => {
    renderApp("/map?sel=map%3A20");
    await screen.findByRole("heading", { name: "Rizal Hall" });
    const handle = within(card()).getByRole("button", { name: "Expand details" });
    expect(within(card()).queryByText("Building details coming soon.")).not.toBeInTheDocument();
    await userEvent.click(handle);
    expect(await within(card()).findByText("Building details coming soon.")).toBeInTheDocument();
    await userEvent.click(within(card()).getByRole("button", { name: "Collapse details" }));
    expect(within(card()).queryByText("Building details coming soon.")).not.toBeInTheDocument();
  });
});
