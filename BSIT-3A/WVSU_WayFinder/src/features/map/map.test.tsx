import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test-utils";

describe("Campus Map (demo places + demo walkways)", () => {
  it("room destination: building is the destination; room and floor shown separately with the floor plan", async () => {
    renderApp("/map?to=room-demo-cb-203");
    const dest = await screen.findByRole("article", { name: "Destination" });
    expect(within(dest).getByText("Demo College Building")).toBeInTheDocument();
    const inside = screen.getByRole("article", { name: "Inside the building" });
    expect(within(inside).getByText("CB203")).toBeInTheDocument();
    expect(within(inside).getByText("2")).toBeInTheDocument();
    expect(await within(inside).findByAltText("Demo CB floor 2")).toBeInTheDocument();
  });

  it("choose a starting building → route with time; switching start keeps the destination", async () => {
    const loc = renderApp("/map?to=room-demo-cb-203");
    await screen.findByRole("article", { name: "Destination" });
    await userEvent.click(screen.getByRole("button", { name: "Choose starting point" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Demo Administration Building/ }));
    expect(loc.current).toBe("/map?to=room-demo-cb-203&from=bldg-demo-admin");
    const route = screen.getByRole("article", { name: "Directions" });
    expect(await within(route).findByText(/min$/)).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Destination" })).getByText("Demo CB main entrance")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Choose starting point" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /LIB1/ }));
    expect(loc.current).toBe("/map?to=room-demo-cb-203&from=room-demo-lib-1");
    expect(await within(screen.getByRole("article", { name: "Directions" })).findByText(/min$/)).toBeInTheDocument();
  });

  it("location permission denied → explains and keeps Choose starting point available", async () => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) => err({ code: 1 }) },
    });
    renderApp("/map?to=room-demo-cb-203");
    await screen.findByRole("article", { name: "Destination" });
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(/You didn’t allow location access/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose starting point" })).toBeEnabled();
  });

  it("My Location flow: destination → deny permission → choose room manually → destination kept", async () => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) => err({ code: 1 }) },
    });
    const loc = renderApp("/map?to=room-demo-cb-203");
    await screen.findByRole("article", { name: "Destination" });
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(/You didn’t allow location access/)).toBeInTheDocument();
    expect(loc.current).toBe("/map?to=room-demo-cb-203");

    await userEvent.click(screen.getByRole("button", { name: "Choose starting point" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /LIB1/ }));
    expect(loc.current).toBe("/map?to=room-demo-cb-203&from=room-demo-lib-1");
    const directions = screen.getByRole("article", { name: "Directions" });
    expect(await within(directions).findByText("LIB1")).toBeInTheDocument();
    expect(screen.queryByText(/You didn’t allow location access/)).not.toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Destination" })).getByText("Demo College Building")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Inside the building" })).getByText("CB203")).toBeInTheDocument();
  });

  it("GPS result arriving after a manual pick does not replace the manual start", async () => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    let deliver: (() => void) | undefined;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (p: unknown) => void) => {
          deliver = () => ok({ coords: { longitude: 122.5613, latitude: 10.71614, accuracy: 8 } });
        },
      },
    });
    const loc = renderApp("/map?to=room-demo-cb-203");
    await screen.findByRole("article", { name: "Destination" });
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByRole("button", { name: "Locating…" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Choose starting point" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /LIB1/ }));
    expect(loc.current).toBe("/map?to=room-demo-cb-203&from=room-demo-lib-1");

    await act(async () => deliver!());
    expect(loc.current).toBe("/map?to=room-demo-cb-203&from=room-demo-lib-1");
    expect(screen.queryByText(/accuracy ±/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use my location" })).toBeEnabled();
  });

  it("poor GPS accuracy → asks for a manual start instead of routing", async () => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { longitude: 122.5613, latitude: 10.71614, accuracy: 120 } }) },
    });
    const loc = renderApp("/map?to=room-demo-cb-203");
    await screen.findByRole("article", { name: "Destination" });
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(/GPS accuracy is poor/)).toBeInTheDocument();
    expect(screen.getByText("Poor")).toBeInTheDocument();
    expect(loc.current).toContain("to=room-demo-cb-203");
  });

  it("good GPS near a walkway → route from my location", async () => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { longitude: 122.5613, latitude: 10.71614, accuracy: 8 } }) },
    });
    renderApp("/map?to=room-demo-lib-1");
    await screen.findByRole("article", { name: "Destination" });
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText("Good")).toBeInTheDocument();
    expect(await within(screen.getByRole("article", { name: "Directions" })).findByText(/min$/)).toBeInTheDocument();
    expect(screen.getByText(/You are here · accuracy/)).toBeInTheDocument();
  });

  it("opening the Map never asks for location; tapping Use my location shows You are here", async () => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void) => ok({ coords: { longitude: 122.5613, latitude: 10.71614, accuracy: 8 } }));
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    const loc = renderApp("/map");
    const card = await screen.findByRole("article", { name: "My location" });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    await userEvent.click(within(card).getByRole("button", { name: "Use my location" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/You are here · accuracy ±8 m/)).toBeInTheDocument();
    expect(loc.current).toBe("/map?from=gps");
  });
});
