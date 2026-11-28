import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

const at = (url: string) => render(<MemoryRouter initialEntries={[url]}><App /></MemoryRouter>);

describe("redesigned WayFinder app", () => {
  beforeEach(() => localStorage.clear());

  it("Home shows the next class, its room and Find classroom", async () => {
    at("/home?returning=1");
    expect(await screen.findByText("Good morning, Juan.")).toBeInTheDocument();
    expect(screen.getByText("CIT 213", { selector: ".nc-code" })).toBeInTheDocument();
    expect(screen.getByText("ICT 306", { selector: ".room" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Find classroom/ })).toHaveAttribute("href", "/class/CIT%20213/1");
  });

  it("an empty schedule asks for a timetable scan", async () => {
    at("/home?first=1");
    expect(await screen.findByText("Add your class schedule")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Scan timetable/ })).toHaveAttribute("href", "/scan");
  });

  it("profile setup blocks an empty student number", async () => {
    at("/profile?step=1");
    await userEvent.click(await screen.findByRole("button", { name: /Continue/ }));
    expect(await screen.findByText("Enter your student number. It’s on your WVSU ID.")).toBeInTheDocument();
  });

  it("Directory search finds the Registrar and the transcript process", async () => {
    at("/directory?q=transcript");
    expect(await screen.findByText("Registrar’s Office")).toBeInTheDocument();
    expect(screen.getByText("Request a Transcript of Records")).toBeInTheDocument();
  });

  it("Directory Rooms lists every building's rooms and finds a door code typed loosely", async () => {
    at("/directory?tab=rooms");
    expect(await screen.findByText(/424 places in 20 buildings/)).toBeInTheDocument();
    expect(screen.getByText("New Academic Building")).toBeInTheDocument();
    expect(screen.getByText("College of Nursing")).toBeInTheDocument();
  });

  it("Directory Rooms: 'nab 201' finds NAB 201 on floor 2, and a mapped room links to its floor plan", async () => {
    at("/directory?tab=rooms&q=nab%20201");
    expect(await screen.findByText("NAB 201")).toBeInTheDocument();
    expect(screen.getByText(/Floor 2 · Room/)).toBeInTheDocument();
    at("/directory?tab=rooms&q=ICT%20302");
    expect((await screen.findByText("ICT 302")).closest("a")).toHaveAttribute("href", expect.stringMatching(/^\/map\/place\/cict-building\?room=/));
  });

  it("QH 1 opens on Floor 1 of Quezon Hall, outlined in gold", async () => {
    at("/map/place/quezon-hall?floor=1&room=QH%201&settled=1");
    expect(await screen.findByText(/is outlined in gold/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Floor 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("the route view offers a walk preview from CICT", async () => {
    at("/map/route?from=cict-building&to=quezon-hall");
    expect(await screen.findByRole("button", { name: /Preview walk/ })).toBeInTheDocument();
    expect(screen.getByText("Quezon Hall entrance")).toBeInTheDocument();
  });
});
