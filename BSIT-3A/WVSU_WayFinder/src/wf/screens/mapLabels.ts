/* Campus map labels: what every outline is called, what kind of place it is, and where its name can go
   without colliding. Names are placed greedily in priority order in screen space, so zooming in reveals
   more of them and swaps short names for full ones. */

export type MapCat = "academic" | "service" | "green" | "parking" | "gate";
export interface ShapeMeta { full: string; short: string; cat: MapCat; rank?: number }

/** Every outline in the MapTiler dataset. `full` is what people call it; `short` fits a small footprint. */
export const SHAPE_META: Record<string, ShapeMeta> = {
  "Quezon Hall": { full: "Quezon Hall", short: "Quezon", cat: "academic", rank: 10 },
  "CICT Building": { full: "CICT Building", short: "CICT", cat: "academic", rank: 10 },
  Administration: { full: "Administration Building", short: "Admin", cat: "service", rank: 10 },
  Library: { full: "Library", short: "Library", cat: "academic", rank: 9 },
  Hometel: { full: "Student’s Center", short: "Hometel", cat: "service", rank: 9 },
  "Rizal Hall": { full: "Rizal Hall", short: "Rizal", cat: "academic", rank: 9 },
  "New Academic Building": { full: "New Academic Building", short: "NAB", cat: "academic", rank: 8 },
  "College of Education": { full: "College of Education", short: "COE", cat: "academic", rank: 6 },
  "College of Dentistry": { full: "College of Dentistry", short: "Dentistry", cat: "academic", rank: 7 },
  "College of Business and Management": { full: "Business & Management", short: "CBM", cat: "academic", rank: 7 },
  "College of Nursing": { full: "College of Nursing", short: "Nursing", cat: "academic", rank: 7 },
  "College of Communication": { full: "College of Communication", short: "COC", cat: "academic", rank: 7 },
  "Center for Foreign Languages": { full: "Foreign Languages", short: "CFL", cat: "academic", rank: 6 },
  "College of Medicine (Roxas Hall)": { full: "Roxas Hall · Medicine", short: "Roxas", cat: "academic", rank: 7 },
  "PSFW Building / College of Medicine (Annex 1)": { full: "COM Annex 1", short: "Annex 1", cat: "academic", rank: 6 },
  "College of Medicine - Annex 3": { full: "COM Annex 3", short: "Annex 3", cat: "academic", rank: 6 },
  "COP Building": { full: "COP Building · PESCAR", short: "COP", cat: "academic", rank: 7 },
  CTE: { full: "CTE", short: "CTE", cat: "academic", rank: 5 },
  "Research Building 1": { full: "Research Bldg 1", short: "RB 1", cat: "academic", rank: 5 },
  "Research Building 2": { full: "Research Bldg 2", short: "RB 2", cat: "academic", rank: 5 },
  "Audio Visual Hall": { full: "Audio Visual Hall", short: "AV Hall", cat: "academic", rank: 5 },
  "Coop Building": { full: "Coop · Canteen", short: "Coop", cat: "service", rank: 7 },
  "Cultural Center": { full: "Cultural Center", short: "Cultural", cat: "service", rank: 6 },
  "COM Gymnasium": { full: "COM Gymnasium", short: "Gym", cat: "service", rank: 5 },
  "Women's Dormitory": { full: "Women’s Dormitory", short: "Dorm", cat: "service", rank: 5 },
  "Supply Office": { full: "Supply Office", short: "Supply", cat: "service", rank: 4 },
  "GSO Office": { full: "GSO Office", short: "GSO", cat: "service", rank: 4 },
  Motorpool: { full: "Motorpool", short: "Motorpool", cat: "service", rank: 3 },
  "Manufacturing Office": { full: "Manufacturing Office", short: "Mfg", cat: "service", rank: 3 },
  "Recovery Facility": { full: "Recovery Facility", short: "Recovery", cat: "service", rank: 3 },
  BINHI: { full: "BINHI", short: "BINHI", cat: "service", rank: 4 },
  "ROTC Office & Alumni Building": { full: "ROTC & Alumni", short: "ROTC", cat: "service", rank: 4 },
  "Commercial Building / URGP / Printing Press": { full: "Commercial Bldg · Printing", short: "Commercial", cat: "service", rank: 4 },
  "Grand Stand": { full: "Grand Stand", short: "Stand", cat: "green", rank: 3 },
  "Scintilla Shed": { full: "Scintilla Shed", short: "Shed", cat: "service", rank: 2 },
  "Football Field": { full: "Football Field", short: "Field", cat: "green", rank: 6 },
  "Wellness Park": { full: "Wellness Park", short: "Park", cat: "green", rank: 5 },
  "Mini Forest": { full: "Mini Forest", short: "Forest", cat: "green", rank: 4 },
  "Parking Lot": { full: "Parking", short: "P", cat: "parking", rank: 2 },
  "Parking Lot 2": { full: "Parking", short: "P", cat: "parking", rank: 2 },
  "Entrance (Main Gate)": { full: "Main Gate", short: "Main Gate", cat: "gate", rank: 9 },
  "Entrance (Second Gate)": { full: "Second Gate", short: "Gate 2", cat: "gate", rank: 7 },
  "Entrance (Back Gate)": { full: "Back Gate", short: "Back Gate", cat: "gate", rank: 6 },
  "Exit (Main Gate)": { full: "Main Gate", short: "Main Gate", cat: "gate", rank: -1 },
  "Exit (Second Gate)": { full: "Second Gate", short: "Gate 2", cat: "gate", rank: -1 },
  "Exit (Back Gate)": { full: "Back Gate", short: "Back Gate", cat: "gate", rank: -1 },
};

export const metaOf = (name: string): ShapeMeta => SHAPE_META[name] || { full: name, short: name, cat: "service", rank: 1 };
export const isGate = (name: string) => metaOf(name).cat === "gate";

export const CAT_LABEL: Record<Exclude<MapCat, "gate">, string> = {
  academic: "Colleges & classrooms", service: "Offices & services", green: "Sports & open spaces", parking: "Parking",
};

/** Splits a long name over two lines at the space nearest the middle. */
export function wrap(text: string, max = 15): string[] {
  if (text.length <= max) return [text];
  // A " · " joins two names: break there first, and never start a line with the dot.
  const dot = text.indexOf(" · ");
  if (dot > 0) return [text.slice(0, dot), text.slice(dot + 3)];
  const mid = text.length / 2; let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

export interface PlacedLabel { name: string; lines: string[]; x: number; y: number; fpx: number; cat: MapCat; sel: boolean; start: boolean }
interface Cand { name: string; cx: number; cy: number; wPx: number; hPx: number; meta: ShapeMeta; sel: boolean; start: boolean; prio: number }

const CHAR = 0.56; // average Fira Sans bold advance, in ems

/** Greedy, collision-free label placement. `k` = screen px per map unit; `view` = [x, y, w, h] in map units. */
export function placeLabels(shapes: { name: string; cx: number; cy: number; w: number; h: number }[], k: number, view: number[],
  opts: { sel?: string | null; start?: string; hide?: string[]; reserve?: { x: number; y: number; w: number; h: number }[] }): PlacedLabel[] {
  const [vx, vy, vw, vh] = view, hide = new Set(opts.hide || []);
  const cands: Cand[] = shapes.filter((s) => !hide.has(s.name) && metaOf(s.name).rank !== -1).map((s) => {
    const meta = metaOf(s.name), sel = s.name === opts.sel, start = !sel && s.name === opts.start;
    return { name: s.name, cx: s.cx, cy: s.cy, wPx: s.w * k, hPx: s.h * k, meta, sel, start, prio: (sel ? 100 : start ? 60 : 0) + (meta.rank ?? 1) * 4
      // bigger on screen wins, and so does whatever you've zoomed in towards (the middle of the view)
      + Math.min(10, Math.sqrt(s.w * s.h) * k / 18) + 14 * Math.max(0, 1 - Math.hypot(s.cx - (vx + vw / 2), s.cy - (vy + vh / 2)) / (Math.min(vw, vh) / 2.2)) };
  }).filter((c) => c.cx >= vx - 4 && c.cx <= vx + vw + 4 && c.cy >= vy - 4 && c.cy <= vy + vh + 4)
    .sort((a, b) => b.prio - a.prio);
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = (opts.reserve || []).map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
  const out: PlacedLabel[] = [];
  const hits = (b: { x0: number; y0: number; x1: number; y1: number }) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  for (const c of cands) {
    const fpx = c.sel ? 13 : c.meta.cat === "academic" ? 11.5 : c.meta.cat === "gate" ? 10.5 : 10.5;
    // Full name when the building is big enough on screen (or selected); otherwise its short name.
    const roomy = c.sel || c.start || c.wPx > 58 || k > 3.2 || (c.meta.rank ?? 0) >= 9 && k > 1.9;
    const tries = roomy ? [wrap(c.meta.full), [c.meta.short]] : [[c.meta.short]];
    // Try the full name then the short one; each centred first, then nudged just below or above the footprint.
    place: for (const lines of tries) {
      const wPx = Math.max(...lines.map((l) => l.length)) * fpx * CHAR + (c.sel ? 22 : 6), hPx = lines.length * fpx * 1.18 + (c.sel ? 10 : 2);
      // Gates, the selected building (needle) and the start (dot) hang their name below the marker; the rest centre on the building.
      const fixed = c.meta.cat === "gate" || c.sel || c.start;
      const drop0 = c.meta.cat === "gate" ? 9 + hPx / 2 : c.sel || c.start ? 12 + hPx / 2 : 0;
      const nudge = Math.min(c.hPx / 2, 24) + hPx / 2;
      for (const drop of fixed ? [drop0] : [0, nudge, -nudge]) {
        const sx = (c.cx - vx) * k, sy = (c.cy - vy) * k + drop;
        const b = { x0: sx - wPx / 2 - 2, y0: sy - hPx / 2 - 1, x1: sx + wPx / 2 + 2, y1: sy + hPx / 2 + 1 };
        // Whole label on screen, clear of other labels and of the screen's own controls.
        const off = b.x0 < 4 || b.y0 < 4 || b.x1 > vw * k - 4 || b.y1 > vh * k - 4;
        if (off || (!c.sel && hits(b))) continue;
        boxes.push(b);
        out.push({ name: c.name, lines, x: c.cx, y: c.cy + drop / k, fpx, cat: c.meta.cat, sel: c.sel, start: c.start });
        break place;
      }
    }
  }
  return out;
}
