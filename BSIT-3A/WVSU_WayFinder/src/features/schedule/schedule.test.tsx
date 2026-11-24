import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test-utils";
import { scheduleStore } from "../../lib/schedule/store";

beforeEach(() => scheduleStore._reset());

async function addClass(fields: { subject: string; day: string; start: string; end: string; room: string; prof?: string }) {
  await userEvent.type(screen.getByLabelText("Subject"), fields.subject);
  await userEvent.selectOptions(screen.getByLabelText("Day"), fields.day);
  const start = screen.getByLabelText("Starts");
  await userEvent.clear(start);
  await userEvent.type(start, fields.start);
  const end = screen.getByLabelText("Ends");
  await userEvent.clear(end);
  await userEvent.type(end, fields.end);
  await userEvent.type(screen.getByLabelText("Room code"), fields.room);
  if (fields.prof) await userEvent.type(screen.getByLabelText("Professor"), fields.prof);
  await userEvent.click(screen.getByRole("button", { name: "Save class" }));
}

describe("My Schedule flow (demo places, device-only storage)", () => {
  it("Home → Add my schedule → next class with room, professor and Find room", async () => {
    const loc = renderApp("/");
    await userEvent.click(screen.getByRole("link", { name: "Add my schedule" }));
    expect(loc.current).toBe("/schedule/new");
    const today = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      new Date(Date.now() + 8 * 3600e3).getUTCDay()];
    await addClass({ subject: "CIT 210 Web Systems", day: today, start: "23:58", end: "23:59", room: "cb 203", prof: "Demo Prof. Maria Mapped" });
    expect(await screen.findByText("CIT 210 Web Systems")).toBeInTheDocument();
    expect(loc.current).toBe("/schedule");

    await userEvent.click(screen.getByRole("link", { name: "← Home" }));
    const card = await screen.findByRole("article", { name: "Next class" });
    expect(within(card).getByText("CIT 210 Web Systems")).toBeInTheDocument();
    expect(within(card).getByText("cb 203")).toBeInTheDocument(); // kept exactly as typed
    expect(within(card).getByText(/Demo Prof. Maria Mapped/)).toBeInTheDocument();
    expect(within(card).getByText(/11:58 PM/)).toBeInTheDocument();
    expect(within(card).queryByText("Room location unconfirmed")).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /find room/i })).toHaveAttribute("href", "/map?to=room-demo-cb-203");
  });

  it("editing a class updates Home's next-class card and its Find room destination", async () => {
    const loc = renderApp("/schedule/new");
    const today = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.now() + 8 * 3600e3).getUTCDay()];
    await addClass({ subject: "CIT 210 Web Systems", day: today, start: "23:58", end: "23:59", room: "cb 203" });
    await userEvent.click(await screen.findByRole("link", { name: /CIT 210 Web Systems/ }));
    const subj = screen.getByLabelText("Subject");
    await userEvent.clear(subj); await userEvent.type(subj, "CIT 220 Networks");
    const room = screen.getByLabelText(/Room/);
    await userEvent.clear(room); await userEvent.type(room, "ICT-201");
    await userEvent.click(screen.getByRole("button", { name: "Save class" }));
    expect(await screen.findByText("CIT 220 Networks")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "← Home" }));
    const card = await screen.findByRole("article", { name: "Next class" });
    expect(within(card).getByText("CIT 220 Networks")).toBeInTheDocument();
    expect(within(card).queryByText("CIT 210 Web Systems")).not.toBeInTheDocument();
    expect(within(card).getByText("ICT-201")).toBeInTheDocument(); // kept exactly as typed
    expect(within(card).getByRole("link", { name: /find room/i })).toHaveAttribute("href", "/map?to=room-demo-ict-201");
    expect(loc.current).toBe("/");
  });

  it("an unmatched room code is preserved and marked Room location unconfirmed", async () => {
    renderApp("/schedule/new");
    await addClass({ subject: "PE 1", day: "Wednesday", start: "07:30", end: "09:00", room: "GYM-X 9" });
    expect(await screen.findByText("GYM-X 9")).toBeInTheDocument();
    expect(screen.getByText("Room location unconfirmed")).toBeInTheDocument();
    expect(scheduleStore.list()[0]).toMatchObject({ roomCodeRaw: "GYM-X 9", roomPlaceId: undefined });
  });

  it("edit and delete a class", async () => {
    const loc = renderApp("/schedule/new");
    await addClass({ subject: "Math 1", day: "Tuesday", start: "10:00", end: "11:00", room: "CB 101" });
    await userEvent.click(await screen.findByRole("link", { name: /Math 1, Tuesday/ }));
    const subj = screen.getByLabelText("Subject");
    await userEvent.clear(subj);
    await userEvent.type(subj, "Math 2");
    await userEvent.click(screen.getByRole("button", { name: "Save class" }));
    expect(await screen.findByText("Math 2")).toBeInTheDocument();
    expect(scheduleStore.list()).toHaveLength(1);
    await userEvent.click(screen.getByRole("link", { name: /Math 2, Tuesday/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete class" }));
    expect(loc.current).toBe("/schedule");
    expect(scheduleStore.list()).toEqual([]);
    expect(screen.getByText("No classes yet")).toBeInTheDocument();
  });

  it("rejects an end time before the start", async () => {
    renderApp("/schedule/new");
    await addClass({ subject: "X", day: "Monday", start: "10:00", end: "09:00", room: "CB 203" });
    expect(screen.getByText("End time must be after the start time.")).toBeInTheDocument();
  });

  it("uploads a timetable image privately (stored on this device only)", async () => {
    const orig = { cib: globalThis.createImageBitmap, toDataURL: HTMLCanvasElement.prototype.toDataURL, getContext: HTMLCanvasElement.prototype.getContext };
    globalThis.createImageBitmap = (async () => ({ width: 800, height: 600 })) as never;
    HTMLCanvasElement.prototype.getContext = (() => ({ drawImage() {} })) as never;
    HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,AAA";
    try {
      renderApp("/schedule");
      await userEvent.upload(screen.getByTestId("timetable-input"), new File(["x"], "sched.png", { type: "image/png" }));
      expect(await screen.findByAltText("Your uploaded timetable")).toHaveAttribute("src", "data:image/jpeg;base64,AAA");
      expect(localStorage.getItem("wf.schedule.image.v1")).toBe("data:image/jpeg;base64,AAA");
      await userEvent.click(screen.getByRole("button", { name: "Remove image" }));
      expect(localStorage.getItem("wf.schedule.image.v1")).toBeNull();
    } finally {
      globalThis.createImageBitmap = orig.cib;
      HTMLCanvasElement.prototype.toDataURL = orig.toDataURL;
      HTMLCanvasElement.prototype.getContext = orig.getContext;
    }
  });
});
