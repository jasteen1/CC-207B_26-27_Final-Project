import { CAMPUS } from "../data/campus";
import { SHAPE_META, metaOf, placeLabels, wrap } from "./mapLabels";

const shapes = (CAMPUS.shapes as any[]).filter((s) => !s.line && "cx" in s).map((s) => ({ name: s.name, cx: s.cx, cy: s.cy, w: 20, h: 20 }));

describe("campus map labels", () => {
  it("every outline on the campus map has a name and a kind", () => {
    const missing = shapes.map((s) => s.name).filter((n) => !SHAPE_META[n]);
    expect(missing).toEqual([]);
  });

  it("every building's name shows once you zoom in on it", () => {
    for (const s of shapes) {
      if (metaOf(s.name).rank === -1) continue; // exit gates share their entrance's name
      const k = 4, w = 390 / k, h = 844 / k, view = [s.cx - w / 2, s.cy - h / 2, w, h];
      const placed = placeLabels(shapes, k, view, {}).map((l) => l.name);
      expect(placed, s.name).toContain(s.name);
    }
  });

  it("labels never overlap", () => {
    const k = 1.1, view = [8, -122, 390 / k, 844 / k];
    const ls = placeLabels(shapes, k, view, {});
    const box = (l: (typeof ls)[number]) => { const wd = Math.max(...l.lines.map((t) => t.length)) * l.fpx * 0.56, ht = l.lines.length * l.fpx * 1.18;
      const x = (l.x - view[0]) * k, y = (l.y - view[1]) * k; return [x - wd / 2, y - ht / 2, x + wd / 2, y + ht / 2]; };
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
      const a = box(ls[i]), b = box(ls[j]);
      expect(a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1], `${ls[i].name} × ${ls[j].name}`).toBe(false);
    }
  });

  it("the selected building always gets its full name", () => {
    const k = 1.1, view = [8, -122, 390 / k, 844 / k];
    const sel = placeLabels(shapes, k, view, { sel: "Quezon Hall" }).find((l) => l.name === "Quezon Hall");
    expect(sel).toMatchObject({ sel: true, lines: ["Quezon Hall"] });
  });

  it("long names break at the joining dot, never leaving it at the start of a line", () => {
    expect(wrap("Roxas Hall · Medicine")).toEqual(["Roxas Hall", "Medicine"]);
    expect(wrap("New Academic Building")).toEqual(["New Academic", "Building"]);
  });
});
