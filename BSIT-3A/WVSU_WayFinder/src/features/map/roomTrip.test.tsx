// Search ICT 201 → CICT Building → starting point → route to the entrance → blueprint with ICT 201
// highlighted. DEMO place records and walkways; building polygons from the real dataset excerpt.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test-utils";
import sample from "./wayfinder-sample.json";
import { parseBuildings } from "./buildings";

vi.mock("./buildings", async (orig) => {
  const real = await orig<typeof import("./buildings")>();
  return { ...real, campusBuildingsOnce: async () => real.parseBuildings(sample as Parameters<typeof real.parseBuildings>[0]) };
});
const shapes = parseBuildings(sample as Parameters<typeof parseBuildings>[0]);

describe("classroom search → route → highlighted room", () => {
  it.each(["ICT 201", "ICT-201", "ict201"])("search %s finds ICT 201 in the CICT building, floor 2, labelled as on the door", async (q) => {
    renderApp(`/search?q=${encodeURIComponent(q)}`);
    const article = (await screen.findByText("Demo Room ICT 201")).closest("article")!;
    expect(within(article).getByText("ICT 201")).toBeInTheDocument();
    expect(within(article).getByText("Demo CICT Building")).toBeInTheDocument();
    expect(within(article).getByText("2")).toBeInTheDocument();
  });

  it("full flow: Show on Map → choose a starting building → route to the entrance → blueprint with ICT 201 highlighted", async () => {
    const loc = renderApp("/search?q=ICT-201");
    await userEvent.click(within((await screen.findByText("Demo Room ICT 201")).closest("article")!).getByRole("link", { name: /Show on Map/ }));
    expect(loc.current).toBe("/map?to=room-demo-ict-201");
    const dest = await screen.findByRole("article", { name: "Destination" });
    expect(within(dest).getByText("Demo CICT Building")).toBeInTheDocument();
    expect(within(dest).getByText(/go inside to ICT 201/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Choose starting point" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Demo Administration Building/ }));
    expect(loc.current).toBe("/map?to=room-demo-ict-201&from=bldg-demo-admin");
    expect(await within(screen.getByRole("article", { name: "Directions" })).findByText(/min$/)).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Destination" })).getByText("Demo CICT east entrance")).toBeInTheDocument();

    const inside = screen.getByRole("article", { name: "Inside the building" });
    expect(within(inside).getByText("ICT 201", { selector: "dd" })).toBeInTheDocument();
    expect(within(inside).getByText("2", { selector: "dd" })).toBeInTheDocument();
    expect(await within(inside).findByAltText("Demo CICT floor 2")).toBeInTheDocument();
    const mark = within(inside).getByRole("img", { name: "ICT 201 highlighted on the floor plan" });
    expect(mark).toHaveStyle({ left: `${(0.05 + 0.183333 / 2) * 100}%`, top: "10%" });

    await userEvent.click(within(inside).getByRole("button", { name: "Open floor plan" }));
    const viewer = screen.getByRole("dialog", { name: "Floor plan: Demo CICT floor 2" });
    await userEvent.click(within(viewer).getByRole("button", { name: "Zoom in" }));
    await userEvent.click(within(viewer).getByRole("button", { name: "Zoom in" }));
    // Zooming resizes the shared box; the highlight keeps the same fractional position inside it.
    expect(within(viewer).getByTestId("plan-image")).toHaveStyle({ width: "200%" });
    const zoomedMark = within(viewer).getByRole("img", { name: "ICT 201 highlighted on the floor plan" });
    expect(zoomedMark.parentElement).toBe(within(viewer).getByTestId("plan-image"));
    expect(zoomedMark).toHaveStyle({ top: "10%" });
  });

  it("same building: starting in ICT 101 goes straight to the indoor step", async () => {
    renderApp("/map?to=room-demo-ict-201&from=room-demo-ict-101");
    const route = await screen.findByRole("article", { name: "Directions" });
    expect(await within(route).findByText("You’re already in this building. Go straight to the floor plan.")).toBeInTheDocument();
    expect(within(route).queryByText(/min$/)).not.toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "ICT 201 highlighted on the floor plan" })).toBeInTheDocument();
  });

  it("a room with no floor plan for its floor says so (floor 1 has none)", async () => {
    renderApp("/map?to=room-demo-ict-101");
    const inside = await screen.findByRole("article", { name: "Inside the building" });
    expect(await within(inside).findByText("No floor plan is available for this floor.")).toBeInTheDocument();
  });

  it("prefix only (ICT 999): points to CICT, room unconfirmed, no floor; the map destination still routes", async () => {
    const loc = renderApp("/search?q=ict%20999");
    expect(await screen.findByText("ICT points to CICT Building. Room 999 hasn’t been confirmed yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Show CICT Building on Map/ }));
    expect(loc.current).toBe("/map?to=map%3A19&code=ICT999");
    const dest = await screen.findByRole("article", { name: "Destination" });
    expect(await within(dest).findByText("Demo CICT Building")).toBeInTheDocument();
    expect(within(dest).getByText("ICT points to CICT Building. Room 999 hasn’t been confirmed yet.")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Inside the building" })).not.toBeInTheDocument();
  });

  it("a map-only building (no linked record) stays the visible destination and explains why there's no route", async () => {
    renderApp(`/map?to=${encodeURIComponent(shapes.find((b) => b.name === "Rizal Hall")!.key)}&from=bldg-demo-admin`);
    const dest = await screen.findByRole("article", { name: "Destination" });
    expect(await within(dest).findByText("Rizal Hall")).toBeInTheDocument();
    expect(within(dest).getByText("Map only")).toBeInTheDocument();
    expect(await within(screen.getByRole("article", { name: "Directions" })).findByText(/Rizal Hall isn’t linked to a WayFinder building record yet/)).toBeInTheDocument();
  });

  it("start picker lists campus-map buildings; picking one keeps the destination and explains no route", async () => {
    const loc = renderApp("/map?to=room-demo-ict-201");
    await screen.findByRole("article", { name: "Destination" });
    await userEvent.click(screen.getByRole("button", { name: "Choose starting point" }));
    const list = within(screen.getByRole("dialog")).getByRole("list", { name: "Buildings on the campus map" });
    await userEvent.click(within(list).getByRole("button", { name: /^Rizal Hall/ }));
    expect(loc.current).toBe("/map?to=room-demo-ict-201&from=map%3A20");
    expect(await screen.findByText(/Rizal Hall isn’t linked to a WayFinder building record yet, so walking directions from it are unavailable/)).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Destination" })).getByText("Demo CICT Building")).toBeInTheDocument();
  });

  it("office search: Administration shows the matching record; no office is invented", async () => {
    renderApp("/search?q=Administration");
    expect(await screen.findByRole("heading", { name: "Demo Administration Building" })).toBeInTheDocument();
    expect(screen.queryByText(/Office of/)).not.toBeInTheDocument();
  });
});
