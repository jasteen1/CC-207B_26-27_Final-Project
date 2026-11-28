/* WayFinder UI core: data wiring, formatting helpers, icons and the app state store.
   Ported from the clickable prototype (~/Downloads/WayFinder-Prototype/site/app.js), which the
   WayFinder-SVGs design exports were made from. Class names match src/wf/app.css. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WF } from "./data/data";
import { CAMPUS } from "./data/campus";
import { WF_BUILDINGS } from "./data/buildings";
import { WF_FLOORS } from "./data/floors";

export const W = WF;
export { CAMPUS };

/* ---------- data wiring (same merge as the prototype) ---------- */
for (const b of WF_BUILDINGS as any[]) {
  const pl = W.places[b.id] || (W.places[b.id] = { name: b.name, shape: b.shape, kind: "Building", floors: [], about: null, entrance: "none", rooms: {} });
  pl.photo = b.photo; pl.blueprints = b.blueprints; if (b.note) pl.note = b.note; if (!pl.name) pl.name = b.name;
}
for (const [id, fp] of Object.entries(WF_FLOORS as Record<string, any>)) {
  const pl = W.places[id]; if (!pl) continue;
  const before = pl.rooms || {};
  pl.plans = fp.plans; pl.floors = Object.keys(fp.plans).map(Number).sort((a, b) => a - b); pl.rooms = {};
  for (const [k, r] of Object.entries(fp.rooms as Record<string, any>)) pl.rooms[k] = { ...r, verified: r.confirmed, where: `Floor ${r.floor}` };
  for (const [k, r] of Object.entries(before as Record<string, any>)) pl.rooms[k] = { ...(pl.rooms[k] || {}), ...r, confirmed: true };
}
for (const [oid, key] of Object.entries(W.officeRooms || {})) {
  const o = W.offices[oid], pl = o && W.places[o.place], r = pl && pl.rooms && pl.rooms[key as string];
  if (r && r.confirmed) { o.room = key; o.floor = r.floor; }
}

/* ---------- types ---------- */
export type Meeting = [number, string, string, string]; // day (1 = Mon), start, end, room
export interface Subject { code: string; title: string; row?: number; m: Meeting[] }
export interface Note { id: string; kind: "class" | "info"; at: string; title: string; body: string; map?: string; cls?: string; room?: string; code?: string; time?: string; read: boolean }
export interface Profile { role: string; first: string; mi: string; last: string; id: string; college: string; program: string; year: string; section: string; campus: string; dept: string; office: string; position: string; consent?: boolean }
export interface Start { kind: "named" | "gps" | "pin"; id?: string; label: string; shape?: string; pt?: number[] }
export interface State {
  signed: boolean; firstTime: boolean; saved: Subject[] | null; draft: Subject[] | null;
  lastEdit: { key: string; prev: Meeting; label: string } | null; openSubj: number[];
  start: Start | null; pinPt: number[] | null; view: "today" | "week"; weekDay: number;
  ask: string[]; profile: Profile | null; pf: Profile | null; pfErr: Record<string, string> | null;
  notes: Note[]; notified: boolean; moved: { code: string; mi: number; from: string; to: string } | null;
  now: number; introPlayed: boolean; procDone: Record<string, number[]>; orgOpen: boolean; toast: string | null; from: string | null;
}
export const copySchedule = (): Subject[] => W.schedule.map((s: Subject) => ({ ...s, m: s.m.map((m) => m.slice() as Meeting) }));
export const fresh = (): State => ({
  signed: false, firstTime: false, saved: null, draft: null, lastEdit: null, openSubj: [], start: null, pinPt: null,
  view: "today", weekDay: W.today.day, ask: [], profile: null, pf: null, pfErr: null, notes: [], notified: false, moved: null,
  now: W.today.minutes, introPlayed: false, procDone: {}, orgOpen: false, toast: null, from: null,
});

/* ---------- formatting ---------- */
export const day = (d: number) => W.days[d] as string;
export const DAY3 = (d: number) => day(d).slice(0, 3);
export const range = (a: string, b: string) => { const [x, am] = a.split(" "), [y, bm] = b.split(" "); return am === bm ? `${x}–${y} ${bm}` : `${a}–${b}`; };
export const mins = (t: string) => { const [hm, ap] = t.split(" "); let [h, m] = hm.split(":").map(Number); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return h * 60 + (m || 0); };
export const fmtMin = (m: number) => { let h = Math.floor(m / 60); const mm = m % 60, ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${h}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${ap}`; };
export const fmtShort = (m: number) => { let h = Math.floor(m / 60); const mm = m % 60; h = h % 12 || 12; return mm ? `${h}:${String(mm).padStart(2, "0")}` : `${h}`; };
export const buildingOf = (room: string) => (/^ICT/i.test(room) ? "cict-building" : /^QH/i.test(room) ? "quezon-hall" : null);
export const enc = encodeURIComponent;
/** Wide browser windows get the web layout (sidebar, side panels, centred columns); phones keep the app layout. */
export const WIDE_QUERY = "(min-width: 960px)";
const mm = (q: string) => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(q) : null);
export function useWide() {
  const [w, setW] = useState(() => !!mm(WIDE_QUERY)?.matches);
  useEffect(() => { const m = mm(WIDE_QUERY); if (!m) return; const f = () => setW(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return w;
}
/** Prototype asset paths ("assets/…") are served from /wf/. */
export const asset = (src: string) => "/wf/" + String(src).replace(/^assets\//, "");
export const ROLES: [string, string][] = [["student", "Student"], ["faculty", "Faculty"], ["staff", "Staff"]];
export const YEARS = ["1st", "2nd", "3rd", "4th", "5th"];
export const pfBlank = (): Profile => ({ role: "student", first: W.student.first, mi: "", last: W.student.last, id: "", college: "", program: "", year: "", section: "", campus: W.campuses[0], dept: "", office: "", position: "" });
export const pfSample = (): Profile => ({ ...pfBlank(), mi: "S", id: "2023M0482", college: "cict", program: "BS Information Technology", year: "3rd", section: "B" });
export const pfName = (x: Profile) => [x.first, x.mi ? x.mi.replace(/\.?$/, ".") : "", x.last].filter(Boolean).join(" ");
export const initials = (x: Profile) => (((x.first || "").trim()[0] || "") + ((x.last || "").trim()[0] || "")).toUpperCase() || "?";
export const college = (id: string) => W.colleges.find((c: any) => c.id === id);
export const pfLine = (x: Profile) => x.role === "student" ? [x.program, x.year ? `${x.year} year` : "", x.section ? `Section ${x.section}` : ""].filter(Boolean).join(", ")
  : x.role === "faculty" ? [x.dept, college(x.college) && college(x.college).short].filter(Boolean).join(", ")
  : [x.position, x.office && W.offices[x.office] && (W.offices[x.office].short || W.offices[x.office].name)].filter(Boolean).join(", ");

/* ---------- icons ---------- */
const P: Record<string, ReactNode> = {
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>,
  cal: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  bldg: <><path d="M5 21V4h9v17M14 9h5v12" /><path d="M8 8h3M8 12h3M8 16h3" /></>,
  ask: <><path d="M5 5h14v10H10l-5 4z" /><path d="M9 10h6" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  back: <path d="M15 5l-7 7 7 7" />, chev: <path d="M9 6l6 6-6 6" />, arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  pin: <><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  photo: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 16l5-5 4 4 3-3 4 4" /></>,
  check: <path d="M5 12l4 4 10-10" />, x: <path d="M6 6l12 12M18 6L6 18" />, edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  undo: <><path d="M9 7L4 12l5 5" /><path d="M4 12h10a6 6 0 010 12" /></>,
  gps: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></>,
  flag: <path d="M5 21V4h11l-2 4 2 4H5" />, target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>, alert: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-4 4-6 7-6s6 2 7 6" /></>,
  route: <><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8 18h5a3.5 3.5 0 000-7h-2a3.5 3.5 0 010-7h5" /></>,
  ext: <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" /><circle cx="4.5" cy="12" r="1.2" /><circle cx="4.5" cy="18" r="1.2" /></>,
  bell: <><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 004 0" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  minus: <path d="M5 12h14" />, plus: <path d="M12 5v14M5 12h14" />,
  logout: <><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  phone: <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 006.5 6.5L16 14l4 1.5V19a1.5 1.5 0 01-1.5 1.5C10.5 20.5 3.5 13.5 3.5 5.5A1.5 1.5 0 015 4z" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  door: <><path d="M6 21V4h10v17" /><path d="M3 21h18M13 12h.01" /></>,
  caret: <path d="M6 9l6 6 6-6" />,
};
export function I({ n, cls = "ico" }: { n: string; cls?: string }) {
  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={n === "caret" ? 2.2 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>;
}
export const Needle = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L5 21l7-4z" fill="#132D6B" /><path d="M12 2l7 19-7-4z" fill="#3F8FD2" /><circle cx="12" cy="12.5" r="2.6" fill="#F3B53A" stroke="#132D6B" strokeWidth="1" /></svg>
);
export const GoogleG = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.6 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
    <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.4 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z" />
  </svg>
);

/* ---------- store ---------- */
const KEY = "wf-state-v1";
interface Ctx { S: State; set: (fn: (d: State) => void) => void; reset: () => void; reduced: boolean }
const StoreCtx = createContext<Ctx | null>(null);
function load(): State {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...fresh(), ...JSON.parse(raw), toast: null, pfErr: null }; } catch { /* ignore */ }
  return fresh();
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [S, setS] = useState<State>(load);
  const ref = useRef(S); ref.current = S;
  const set = useCallback((fn: (d: State) => void) => {
    const d = structuredClone(ref.current); fn(d); ref.current = d; setS(d);
  }, []);
  const reset = useCallback(() => { ref.current = fresh(); setS(ref.current); }, []);
  useEffect(() => { try { const { toast: _t, pfErr: _e, ...keep } = S; localStorage.setItem(KEY, JSON.stringify(keep)); } catch { /* ignore */ } }, [S]);
  const reduced = useMemo(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  return <StoreCtx.Provider value={{ S, set, reset, reduced }}>{children}</StoreCtx.Provider>;
}
export function useWF() {
  const c = useContext(StoreCtx); if (!c) throw new Error("useWF outside StoreProvider");
  return c;
}

/* ---------- schedule helpers (pure; take the state) ---------- */
export const sched = (S: State) => S.saved;
export function upcoming(S: State) {
  const s = sched(S); if (!s) return [] as { x: Subject; si: number; mi: number; m: Meeting }[];
  const out: { x: Subject; si: number; mi: number; m: Meeting }[] = [];
  s.forEach((x, si) => x.m.forEach((m, mi) => { if (m[0] === W.today.day) out.push({ x, si, mi, m }); }));
  return out.sort((a, b) => mins(a.m[1]) - mins(b.m[1]));
}
export const movedNote = (S: State, code: string, mi: number) => (S.moved && S.moved.code === code && S.moved.mi === mi ? S.moved : null);
export const unread = (S: State) => S.notes.filter((n) => !n.read).length;
export const me = (S: State) => S.profile || S.pf || pfBlank();
/** The sample same-day room change carried by the class reminder: today's CIT 251 meets in QH 1. Mutates the draft state. */
export function applyRoomChange(d: State) {
  const r = W.reminderDemo, x = d.saved && d.saved.find((c) => c.code === r.code); if (!x) return null;
  const m = x.m[r.meeting]; if (!d.moved) d.moved = { code: r.code, mi: r.meeting, from: m[3], to: r.room }; m[3] = d.moved.to; return x;
}
export function reminderNote(d: State): Note | null {
  const r = W.reminderDemo, x = applyRoomChange(d); if (!x) return null; const m = x.m[r.meeting], b = W.places[buildingOf(m[3]) || ""];
  return { id: "remind", kind: "class", at: fmtMin(r.at), title: `${x.code} in 15 min`, body: `Moved to ${m[3]}, ${b ? b.name : ""}.`,
    map: `/map/route?from=${r.from}&to=${buildingOf(m[3])}&room=${enc(m[3])}`, cls: `/class/${enc(x.code)}/${r.meeting}`, room: m[3], code: x.code, time: range(m[1], m[2]), read: false };
}
export function addNote(d: State, n: Note) { d.notes = [n, ...d.notes.filter((x) => x.id !== n.id)]; }
export function draftOf(d: State) { if (!d.draft) d.draft = copySchedule(); return d.draft; }
