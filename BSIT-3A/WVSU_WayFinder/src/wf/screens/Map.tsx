/* 17–25E, 28–28E, 34A–35I: campus map, building card, floor plans, blueprints, outlines, start picker, pin, route walk, process stops. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CAMPUS, I, Needle, W, asset, enc, useWF, useWide, type State } from "../core";
import { Bar, Tabs, Toast, toastHtml } from "../ui/chrome";
import { CAT_LABEL, SHAPE_META, isGate, metaOf, placeLabels, type MapCat } from "./mapLabels";
import { procDone, procStops, nextOf, stopState, shortOf, ProgressBar } from "./Directory";

/* ---------- campus geometry ---------- */
export const shapeBy = (name: string) => CAMPUS.shapes.find((s: any) => s.name === name && !s.line);
export const placeByShape = (name: string) => Object.keys(W.places).find((k) => W.places[k].shape === name);
export const where = (o: any) => `${W.places[o.place].name} · ${o.floor ? `Floor ${o.floor}` : "floor not confirmed"}`;
export const roomOf = (pl: any, key: string | null) => { const r = key && pl.rooms ? pl.rooms[key] : null; return r && r.confirmed && r.rect ? r : null; };
export const routeFor = (from?: string | null, to?: string | null): any => (from && (W.routes[`${from}>${to}`] || Object.values(W.routes).find((r: any) => r.from === from && (r.also || []).includes(to)))) || null;
const routeHref = (r: any, state?: string) => `/map/route?from=${r.from}&to=${r.to}${state ? `&walk=${state}` : ""}`;
const startText = (S: State) => !S.start ? "Choose a starting point" : S.start.kind === "gps" ? "Your location · ±18 m" : S.start.kind === "pin" ? "Point on the map" : S.start.label;
const startPt = (S: State) => { if (!S.start) return null; if (S.start.pt) return S.start.pt; const s = S.start.shape && shapeBy(S.start.shape); return s ? [s.cx, s.cy] : null; };

/** A building's real outline from the campus map, drawn small: the signpost for each group. */
export function Silhouette({ shape, size = 40 }: { shape: string; size?: number }) {
  const sh = shapeBy(shape); if (!sh) return null;
  const n = (sh.d.match(/-?\d+(\.\d+)?/g) || []).map(Number), xs = n.filter((_: number, i: number) => i % 2 === 0), ys = n.filter((_: number, i: number) => i % 2 === 1);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0, m = Math.max(w, h) * 0.14;
  return <svg className="silo" width={size} height={size} viewBox={`${x0 - m} ${y0 - m} ${Math.max(w, h) + 2 * m} ${Math.max(w, h) + 2 * m}`} aria-hidden="true"><path d={sh.d} fill="#F3B53A" stroke="#B87900" strokeWidth={(Math.max(w, h) / 30).toFixed(2)} strokeLinejoin="round" /></svg>;
}

interface MapOpts { focus?: string; sel?: string | null; start?: { pt?: number[] | null } | null; pin?: number[] | null; entrance?: number[] | null; vb?: number[]; hide?: string[]; startShape?: string; inner?: ReactNode; noNeedle?: boolean; stopShapes?: string[]; fit?: boolean; onTapShape?: (name: string) => void; onTapMap?: (pt: number[]) => void; svgRef?: React.Ref<SVGSVGElement>;
  /** Highlight one kind of place and fade the rest. */ cat?: MapCat | null; /** Glide to a building (changing `n` repeats the flight). */ flyTo?: { name: string; n: number } | null; /** Frame the whole campus (campus home); a number sets the frame's top edge in map units. */ overview?: boolean | number;
  /** Web layout: screen px kept clear around the map's framing (side panel, margins). */ pad?: { l: number; t: number; r: number; b: number };
  /** Screen areas (px) covered by the screen's own bars and sheets, where no name should go (negative y counts from the bottom). */ reserve?: { x: number; y: number; w: number; h: number }[] }

/** Outline bounds, measured once. */
const BOX = new Map<string, { w: number; h: number }>();
const boxOf = (s: any) => { let b = BOX.get(s.name); if (!b) { const n = (s.d.match(/-?\d+(\.\d+)?/g) || []).map(Number), xs = n.filter((_: number, i: number) => i % 2 === 0), ys = n.filter((_: number, i: number) => i % 2 === 1);
  b = { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; BOX.set(s.name, b); } return b; };
const SHAPES = () => CAMPUS.shapes.filter((s: any) => !s.line && "cx" in s).map((s: any) => ({ name: s.name, cx: s.cx, cy: s.cy, ...boxOf(s) }));
/** The whole campus, framed for a phone; `top` is the map-unit y at the top edge (guests have one more bar above the map). */
const overviewFrame = (top: number) => [8, top, 365, 790];

export function CampusMap({ focus, sel, start, pin, entrance, vb: vbIn, hide = [], startShape, inner, noNeedle, stopShapes = [], fit, onTapShape, onTapMap, svgRef, cat, flyTo, overview, reserve = [], pad }: MapOpts) {
  let vb = overview ? overviewFrame(typeof overview === "number" ? overview : -99) : [75, 84, 250, 541];
  if (focus) { const s = shapeBy(focus); if (s) vb = [s.cx - 80, s.cy - 70, 160, 346]; }
  if (vbIn) vb = vbIn;
  const own = useRef<SVGSVGElement | null>(null), size = useBoxSize(own);
  // Web layout: frame the campus (or the building) in the part of the window the panel leaves free.
  if (pad && !vbIn) { const fw = Math.max(200, size.w - pad.l - pad.r), fh = Math.max(200, size.h - pad.t - pad.b), fx = pad.l + fw / 2, fy = pad.t + fh / 2;
    const s = focus ? shapeBy(focus) : null, C = [10, 160, 375, 400];
    const kk = s ? 3.4 : Math.min(fw / (C[2] - C[0]), fh / (C[3] - C[1])) * 0.94, cx = s ? s.cx : (C[0] + C[2]) / 2, cy = s ? s.cy : (C[1] + C[3]) / 2;
    vb = [cx - fx / kk, cy - fy / kk, size.w / kk, size.h / kk]; }
  // Drag to pan, pinch or scroll to zoom. Screens that drive the view themselves (vb) keep control of it.
  const pannable = !vbIn, pz = usePanZoom(focus || ""), base = vb;
  if (pannable) { const w = base[2] / pz.z, h = base[3] / pz.z; vb = [base[0] + (base[2] - w) / 2 + pz.dx, base[1] + (base[3] - h) / 2 + pz.dy, w, h]; }
  useEffect(() => { if (!flyTo || !pannable) return; const s = shapeBy(flyTo.name); if (!s) return;
    const z = Math.max(pz.z, 2.2), w = base[2] / z, h = base[3] / z; // land the building a little above centre, clear of the sheet
    pz.animate({ z, dx: s.cx - w / 2 - base[0] - (base[2] - w) / 2, dy: s.cy + h * 0.08 - h / 2 - base[1] - (base[3] - h) / 2 }); }, [flyTo?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  // Screen px per map unit, and the part of the map actually on screen ("slice" crops the long side).
  const k = fit ? Math.min(size.w / vb[2], size.h / vb[3]) : Math.max(size.w / vb[2], size.h / vb[3]);
  const view = [vb[0] + vb[2] / 2 - size.w / k / 2, vb[1] + vb[3] / 2 - size.h / k / 2, size.w / k, size.h / k];
  const toPx = (pt: number[], r: number) => ({ x: (pt[0] - view[0]) * k - r, y: (pt[1] - view[1]) * k - r, w: 2 * r, h: 2 * r });
  const gates = CAMPUS.shapes.filter((s: any) => !s.line && isGate(s.name) && metaOf(s.name).rank !== -1);
  const markers = [start?.pt ? toPx(start.pt, 12) : null, pin ? toPx([pin[0], pin[1] - 12 / k], 16) : null, ...gates.map((g: any) => toPx([g.cx, g.cy], 8))].filter(Boolean) as { x: number; y: number; w: number; h: number }[];
  const ctrlTop = pad ? 24 : overview ? 132 : 76, keepOut = [...markers, ...reserve.map((r) => (r.y < 0 ? { ...r, y: size.h + r.y } : r)), ...(pannable ? [{ x: size.w - 64, y: ctrlTop - 6, w: 64, h: 168 }] : [])];
  const labels = useMemo(() => placeLabels(SHAPES(), k, view, { sel, start: startShape, hide, reserve: keepOut }), [k.toFixed(3), view.map((v) => v.toFixed(1)).join(), sel, startShape, hide.join(), JSON.stringify(keepOut)]); // eslint-disable-line react-hooks/exhaustive-deps
  const u = (px: number) => (px / k).toFixed(2);
  const tapMap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onTapMap) return; const svg = e.currentTarget, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM(); if (!ctm) return; const q = pt.matrixTransform(ctm.inverse()); onTapMap([+q.x.toFixed(1), +q.y.toFixed(1)]);
  };
  const setRef = (el: SVGSVGElement | null) => { own.current = el; if (typeof svgRef === "function") svgRef(el); else if (svgRef) (svgRef as React.MutableRefObject<SVGSVGElement | null>).current = el; };
  return (
    <><svg ref={setRef} className={`map${pannable ? " pannable" : ""}${cat ? " filtering" : ""}`} viewBox={vb.map((v) => +(+v).toFixed(2)).join(" ")} preserveAspectRatio={fit ? "xMidYMid meet" : "xMidYMid slice"} role="img" aria-label="WVSU Main Campus map" onClick={tapMap}
      {...(pannable ? pz.handlers(vb) : {})}>
      <rect x="-400" y="-400" width="1200" height="1600" className="ground" />
      {CAMPUS.shapes.map((s: any, i: number) => { if (s.line) return <path key={i} className="boundary" d={s.d} style={{ strokeWidth: u(1.4), strokeDasharray: `${u(5)} ${u(4)}` }} />;
        const m = metaOf(s.name); if (m.cat === "gate") return null;
        const cls = `bshape c-${m.cat}${placeByShape(s.name) ? " named" : ""}${s.name === sel ? " sel" : ""}${s.name === startShape ? " start" : ""}${stopShapes.includes(s.name) ? " stop-b" : ""}${cat && m.cat !== cat && s.name !== sel ? " dim" : ""}`;
        return <path key={i} className={cls} d={s.d} aria-label={m.full} role="button" tabIndex={-1} style={{ strokeWidth: u(s.name === sel ? 2 : 1) }}
          onClick={onTapShape ? (e) => { e.stopPropagation(); onTapShape(s.name); } : undefined} />; })}
      {gates.map((s: any) => <g key={s.name} className={`gate${cat && cat !== "gate" ? " dim" : ""}`} transform={`translate(${s.cx} ${s.cy}) scale(${(1 / k).toFixed(4)})`}>
        <circle r="8" /><path d="M-3.2 3.5V-1.2a3.2 3.2 0 0 1 6.4 0v4.7" /></g>)}
      {entrance && <g><circle cx={entrance[0]} cy={entrance[1]} r={u(9)} fill="#fff" stroke="#132D6B" strokeWidth={u(2.4)} strokeDasharray={`${u(3)} ${u(2.4)}`} /></g>}
      {labels.map((l) => { const fs = l.fpx / k, lh = fs * 1.18, y0 = l.y - ((l.lines.length - 1) * lh) / 2;
        const wide = Math.max(...l.lines.map((t) => t.length)) * fs * 0.56 + 18 / k, high = l.lines.length * lh + 8 / k;
        return <g key={l.name} className={`mlbl c-${l.cat}${l.sel ? " sel" : ""}${l.start ? " start" : ""}${cat && l.cat !== cat && !l.sel ? " dim" : ""}`}>
          {l.sel && <rect x={l.x - wide / 2} y={y0 - lh / 2 - 4 / k} width={wide} height={high} rx={high / 2} />}
          <text x={l.x} y={y0} textAnchor="middle" dominantBaseline="central" style={{ fontSize: `${fs.toFixed(2)}px`, strokeWidth: `${u(3)}px` }}>
            {l.lines.map((t, j) => <tspan key={j} x={l.x} dy={j ? lh : 0}>{t}</tspan>)}</text></g>; })}
      {sel && !noNeedle && (() => { const s = shapeBy(sel); return s ? <g transform={`translate(${s.cx} ${s.cy - 6 / k}) scale(${(1.5 / k).toFixed(3)})`}><path d="M0 -14 L-7 6 L0 2 Z" fill="#132D6B" /><path d="M0 -14 L7 6 L0 2 Z" fill="#3F8FD2" /><circle cy="-2" r="2.6" fill="#F3B53A" stroke="#132D6B" /></g> : null; })()}
      {start && start.pt && <g><circle cx={start.pt[0]} cy={start.pt[1]} r={u(8)} fill="#2E6FB8" stroke="#fff" strokeWidth={u(2.5)} /></g>}
      {pin && <g transform={`translate(${pin[0]} ${pin[1]}) scale(${(1.4 / k).toFixed(3)})`}><path d="M0 0 C -9 -10 -9 -22 0 -24 C 9 -22 9 -10 0 0 Z" fill="#132D6B" stroke="#fff" strokeWidth="1.5" /><circle cy="-15" r="3.5" fill="#F3B53A" /></g>}
      {inner}
    </svg>
    {pannable && <div className="map-ctrl" role="group" aria-label="Map view">
      <div className="zoom-pair"><button type="button" onClick={() => pz.zoomBy(1.6)} aria-label="Zoom in" disabled={pz.z >= 5}><I n="plus" /></button>
        <button type="button" onClick={() => pz.zoomBy(1 / 1.6)} aria-label="Zoom out" disabled={pz.z <= 0.6}><I n="minus" /></button></div>
      <button type="button" className="recenter" onClick={pz.reset} disabled={!pz.moved} aria-label={focus ? `Recenter on ${metaOf(focus).full}` : "Show the whole campus"}><I n="target" /></button>
    </div>}</>
  );
}

/** The element's rendered size, kept current (falls back to the phone frame before layout). */
function useBoxSize(ref: React.RefObject<Element | null>) {
  const [s, setS] = useState({ w: 390, h: 844 });
  useLayoutEffect(() => { const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setS((o) => (o.w === r.width && o.h === r.height ? o : { w: r.width, h: r.height })); };
    read(); const ro = new ResizeObserver(read); ro.observe(el); return () => ro.disconnect(); }, [ref]);
  return s;
}

/** Pan/zoom state for CampusMap: one finger or the mouse drags, two fingers pinch, the wheel and buttons zoom. Resets when the focus changes. */
function usePanZoom(key: string) {
  const [v, setV] = useState({ dx: 0, dy: 0, z: 1 });
  const cur = useRef(v); cur.current = v;
  const ptrs = useRef(new Map<number, { x: number; y: number }>()), last = useRef<{ x: number; y: number; d: number } | null>(null), dragged = useRef(false), anim = useRef(0);
  const clampZ = (z: number) => Math.min(5, Math.max(0.6, z));
  // Keep the view's centre on the campus so it can't be dragged off into empty space.
  const clamp = (n: { dx: number; dy: number; z: number }) => ({ z: clampZ(n.z), dx: Math.min(260, Math.max(-260, n.dx)), dy: Math.min(320, Math.max(-320, n.dy)) });
  const stop = () => cancelAnimationFrame(anim.current);
  /** Glide to a view: 260 ms, exponential ease-out; instant when the user prefers reduced motion. */
  const animate = (to: { dx: number; dy: number; z: number }) => {
    stop(); const from = cur.current, end = clamp(to), t0 = performance.now(), T = 260;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(end); return; }
    const step = (t: number) => { const p = Math.min(1, (t - t0) / T), e = 1 - Math.pow(2, -10 * p);
      setV({ dx: from.dx + (end.dx - from.dx) * e, dy: from.dy + (end.dy - from.dy) * e, z: from.z * Math.pow(end.z / from.z, e) });
      if (p < 1) anim.current = requestAnimationFrame(step); };
    anim.current = requestAnimationFrame(step);
  };
  useEffect(() => { stop(); setV({ dx: 0, dy: 0, z: 1 }); }, [key]);
  useEffect(() => stop, []);
  const reading = () => { const p = [...ptrs.current.values()]; if (!p.length) return null;
    const x = p.reduce((a, q) => a + q.x, 0) / p.length, y = p.reduce((a, q) => a + q.y, 0) / p.length;
    return { x, y, d: p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0 }; };
  const handlers = (vb: number[]) => ({
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => { stop(); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); last.current = reading(); if (ptrs.current.size === 1) dragged.current = false; },
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
      if (!ptrs.current.has(e.pointerId)) return;
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = reading(), was = last.current; if (!now || !was) return;
      const dx = now.x - was.x, dy = now.y - was.y;
      if (!dragged.current && Math.hypot(dx, dy) < 5 && !(now.d && was.d && Math.abs(now.d - was.d) > 5)) return;
      if (!dragged.current) { dragged.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } }
      const r = e.currentTarget.getBoundingClientRect(), upp = Math.min(vb[2] / (r.width || 1), vb[3] / (r.height || 1)); // svg units per screen pixel ("slice")
      setV((o) => clamp({ dx: o.dx - dx * upp, dy: o.dy - dy * upp, z: now.d && was.d ? o.z * now.d / was.d : o.z }));
      last.current = now;
    },
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => { ptrs.current.delete(e.pointerId); last.current = reading(); },
    onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => { ptrs.current.delete(e.pointerId); last.current = reading(); },
    // A drag must not also count as a tap on a building or a pin drop.
    onClickCapture: (e: React.MouseEvent) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; } },
    onWheel: (e: React.WheelEvent) => { stop(); setV((o) => clamp({ ...o, z: o.z * Math.exp(-e.deltaY * 0.0015) })); },
  });
  return { ...v, moved: Math.abs(v.dx) > 0.5 || Math.abs(v.dy) > 0.5 || Math.abs(v.z - 1) > 0.01, handlers, animate,
    zoomBy: (f: number) => animate({ ...cur.current, z: cur.current.z * f }), reset: () => animate({ dx: 0, dy: 0, z: 1 }) };
}

/** Tapping a building opens its card; buildings with no record get a toast. */
function useTapShape() {
  const nav = useNavigate(), { set } = useWF();
  return (name: string) => { const id = placeByShape(name); if (id) nav(`/map/place/${id}`); else set((d) => { d.toast = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 21V4h9v17M14 9h5v12"/><path d="M8 8h3M8 12h3M8 16h3"/></svg><span><b>${name}</b> · no details recorded yet</span>`; }); };
}

/* ---------- 18–19 campus map + search ---------- */
export function MapHome() {
  const { S, set } = useWF(), [p] = useSearchParams(), nav = useNavigate(), tapRecord = useTapShape(), wide = useWide();
  const [cat, setCat] = useState<MapCat | null>(null), [open, setOpen] = useState(false), [fly, setFly] = useState<{ name: string; n: number } | null>(null), [pick, setPick] = useState<string | null>(null);
  // A building with a record opens its card; one without is highlighted where it stands, with its name.
  const go = (name: string) => { if (placeByShape(name)) { tapRecord(name); return; }
    setPick(name); setOpen(false); setFly((f) => ({ name, n: (f?.n || 0) + 1 }));
    set((d) => { d.toast = `<b>${metaOf(name).full}</b><span> · no details recorded yet</span>`; }); };
  useEffect(() => { if (p.get("guest")) set((d) => { d.signed = false; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const guest = !S.signed, raw = p.get("q") || "", q = raw.trim().toLowerCase();
  const results = q ? [
    ...Object.entries(W.places).map(([id, pl]: [string, any]) => ({ id, name: pl.name as string, sub: pl.floors.length ? `${pl.floors.length} floor${pl.floors.length > 1 ? "s" : ""}` : "Building", href: `/map/place/${id}` })),
    ...Object.entries(W.offices).map(([id, o]: [string, any]) => ({ id, name: o.name as string, sub: where(o), href: `/map/place/${o.place}?office=${id}` })),
    ...Object.entries(W.places).flatMap(([pid, pl]: [string, any]) => Object.entries(pl.rooms || {}).filter(([, r]: [string, any]) => r.floor && r.kind !== "facility").map(([k, r]: [string, any]) => ({ id: pid === "quezon-hall" && k === "QH 1" ? "qh1" : `${pid}:${k}`, name: (r.name || k) as string,
      sub: `${pl.name} · Floor ${r.floor}${r.confirmed && r.rect ? "" : " · location to confirm"}`, href: `/map/place/${pid}?room=${enc(k)}` }))),
  ].filter((r) => r.name.toLowerCase().includes(q) || r.name.toLowerCase().replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) || (q.startsWith("quez") && r.id === "qh1")).slice(0, 14) : [];
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); nav(`/map?q=${enc(String(new FormData(e.currentTarget).get("q") || ""))}`, { replace: true }); };
  return (
    <section className={`view${guest ? "" : " has-tabs"}`}>
      <div className="map-wrap home-map"><CampusMap overview={guest ? -99 : -38} pad={wide ? PANEL_PAD : undefined} reserve={wide ? [PANEL_KEEP] : [{ x: 0, y: 0, w: 9999, h: guest ? 124 : 70 }, { x: 0, y: -(guest ? 200 : 278), w: 9999, h: 400 }]} sel={pick} cat={cat} flyTo={fly} start={S.start ? { pt: startPt(S) } : null} startShape={S.start?.shape} onTapShape={go} onTapMap={() => setPick(null)} /></div>
      <div className="map-top">
        {guest && <div className="row" style={{ justifyContent: "space-between" }}><Link className="btn sm" to="/login" style={{ background: "var(--cream)", color: "var(--navy-2)" }}><I n="back" /> Welcome</Link><Link className="btn sm primary" to="/google">Sign in</Link></div>}
        <form className="field" role="search" onSubmit={submit}><I n="search" /><input name="q" key={raw} defaultValue={raw} placeholder="Search buildings, rooms, offices" aria-label="Search campus" autoFocus={!!p.get("focus")} /></form>
        {q && <div className="list">{results.length ? results.map((r) => <Link key={r.href + r.name} className="item" to={r.href}><span className="grow"><span className="h3">{r.name}</span><span className="small">{r.sub}</span></span><I n="chev" cls="ico chev" /></Link>)
          : <div className="item" style={{ flexDirection: "column", alignItems: "flex-start" }}><span className="h3">No place called “{raw}” yet</span><span className="small">Try a building name, a room like QH 1, or an office like Registrar.</span></div>}</div>}
      </div>
      {!q && <ExploreSheet wide={wide} guest={guest} open={wide || open} setOpen={setOpen} cat={cat} setCat={setCat} go={go} />}
      {!guest && <Tabs on="Map" />}<Toast />
    </section>
  );
}

/** The part of a map (px, relative to its wrapper) not covered by the top bar and the card: below the bar and above
    the bottom sheet on phones, or right of the side panel in the web layout. */
function freeArea(w: HTMLElement, tb: HTMLElement, sh: HTMLElement, gap = 6) {
  const wr = w.getBoundingClientRect(), sr = sh.getBoundingClientRect(), tr = tb.getBoundingClientRect(), W0 = w.offsetWidth, H0 = w.offsetHeight;
  if (sr.width && sr.width < wr.width * 0.6) return { l: sr.right - wr.left + 24, r: W0 - 72, t: 24, b: H0 - 24 };
  return { l: 0, r: W0, t: tr.bottom - wr.top + gap, b: sr.top - wr.top - gap };
}

/** Web layout: the map frames itself right of the 400px side panel, and labels keep out from under it. */
const PANEL_PAD = { l: 24 + 400 + 24, t: 24, r: 84, b: 24 }, PANEL_KEEP = { x: 0, y: 0, w: 24 + 400 + 16, h: 9999 };

/* ---------- campus home sheet: filter the map by kind of place, or browse every building by name ---------- */
const PLACES = Object.entries(SHAPE_META).filter(([, m]) => m.cat !== "gate").map(([name, m]) => ({ name, ...m }))
  .filter((x, i, a) => a.findIndex((y) => y.full === x.full) === i); // the two parking lots read as one entry
function ExploreSheet({ wide, guest, open, setOpen, cat, setCat, go }: { wide: boolean; guest: boolean; open: boolean; setOpen: (b: boolean) => void; cat: MapCat | null; setCat: (c: MapCat | null) => void; go: (name: string) => void }) {
  const cats = (Object.keys(CAT_LABEL) as Exclude<MapCat, "gate">[]).filter((c) => c !== "parking");
  const list = PLACES.filter((x) => !cat || x.cat === cat);
  const groups = cats.filter((c) => !cat || c === cat).map((c) => [c, list.filter((x) => x.cat === c || (c === "green" && x.cat === "parking")).sort((a, b) => a.full.localeCompare(b.full))] as const).filter(([, xs]) => xs.length);
  return (
    <div className={`map-sheet explore${open ? " expanded" : " peek"}`} style={wide ? { ["--panel-top" as string]: guest ? "152px" : "96px" } : undefined}>
      <button className="grab-btn" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="all-places" aria-label={open ? "Collapse the list" : "Show every building"}><span className="grab" /></button>
      <div className="ex-head"><div className="grow"><h2 className="h2">Explore campus</h2><p className="small">{PLACES.length} places. Tap one on the map, or browse them all.</p></div>
        <button type="button" className="btn sm outline" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="all-places">{open ? "Show map" : "Browse all"}</button></div>
      <div className="chips ex-chips" role="group" aria-label="Highlight on the map">
        <button type="button" className="chip" aria-pressed={!cat} onClick={() => setCat(null)}>Everything</button>
        {cats.map((c) => <button key={c} type="button" className={`chip ck-${c}`} aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}><i aria-hidden="true" />{CAT_LABEL[c]}</button>)}</div>
      {open && <div id="all-places" className="ex-list">{groups.map(([c, xs]) => <section key={c} className="ex-group"><h3 className="label">{CAT_LABEL[c]} · {xs.length}</h3>
        <div className="list">{xs.map((x) => { const id = placeByShape(x.name), pl = id ? W.places[id] : null, plan = pl && (pl.plans || (pl.blueprints || []).length);
          return <button key={x.name} type="button" className="item ex-row" onClick={() => go(x.name)}><Silhouette shape={x.name} size={34} />
            <span className="grow"><span className="h3">{x.full}</span><span className="small">{plan ? "Floor plan" : id ? "Details" : "On the map"}</span></span><I n="chev" cls="ico chev" /></button>; })}</div></section>)}</div>}
    </div>
  );
}

/* ---------- 21 floor plan: highlighted room, tappable rooms, every room on the floor ---------- */
function HlShape({ r }: { r: any }) {
  if (!r.clip) return null;
  const pts = r.clip.replace(/^polygon\(|\)$/g, "").split(",").map((p: string) => p.trim().split(/\s+/).map((v) => parseFloat(v) || 0).join(",")).join(" ");
  return <svg className="hl-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={pts} /></svg>;
}
interface FP { id: string; pl: any; floor: number; plan: any; hlR: any; hlKey: string | null; isDest: boolean; keep: string; picked: boolean; r: any; hlName: string; full?: boolean; sel?: string | null }
function useFloorPlan({ id, pl, floor, plan, hlR, hlKey, isDest, keep, picked, r, hlName, full = false, sel = null }: FP) {
  const nav = useNavigate();
  const base = `/map/${full ? "floor" : "place"}/${id}?floor=${floor}${keep}`;
  const go = (h: string) => nav(h, { replace: true });
  const onFloor = Object.entries(pl.rooms).filter(([, x]: [string, any]) => x.floor === floor) as [string, any][];
  const ok = onFloor.filter(([, x]) => x.confirmed && x.rect), todo = onFloor.filter(([, x]) => !x.confirmed || !x.rect);
  const label = (k: string | null) => (k && pl.rooms[k] && pl.rooms[k].name) || k || "";
  const hlText = isDest ? hlName : label(hlKey);
  const planEl = (
    <div className="plan"><img src={asset(plan.src)} alt={`${pl.name}, Floor ${floor} plan`} width={plan.w} height={plan.h} />
      {ok.filter(([, x]) => x !== hlR).map(([k, x]) => <button key={k} className="hit" tabIndex={-1} style={{ left: `${x.rect[0] * 100}%`, top: `${x.rect[1] * 100}%`, width: `${x.rect[2] * 100}%`, height: `${x.rect[3] * 100}%` }} onClick={() => go(`${base}&sel=${enc(k)}`)} aria-label={label(k)} />)}
      {hlR && <>
        <button className={`hl${hlR.clip ? " shaped" : ""}${picked ? " picked" : ""}`} style={{ left: `${hlR.rect[0] * 100}%`, top: `${hlR.rect[1] * 100}%`, width: `${hlR.rect[2] * 100}%`, height: `${hlR.rect[3] * 100}%` }} onClick={() => go(`${base}${isDest ? "&pick=1" : `&sel=${enc(hlKey || "")}`}`)} aria-label={`${hlText}, Floor ${floor}`}><HlShape r={hlR} /></button>
        <span className={`tag${hlR.rect[1] < 0.14 ? " below" : " above"}`} style={{ left: `${Math.min(88, Math.max(12, (hlR.rect[0] + hlR.rect[2] / 2) * 100))}%`, top: `${(hlR.rect[1] < 0.14 ? hlR.rect[1] + hlR.rect[3] : hlR.rect[1]) * 100}%` }}>{hlText}</span>
      </>}
    </div>
  );
  const B = ({ children }: { children: ReactNode }) => <b style={{ color: "var(--ink)" }}>{children}</b>;
  const status = hlR ? (isDest ? (picked ? <><B>{hlName}</B> · Floor {floor}{r.where && /,/.test(r.where) ? `, ${r.where.replace(/^Floor \d+, /, "")}` : ""}</> : <><B>{hlName}</B> is outlined in gold · checked on the floor plan</>)
    : <><B>{label(hlKey)}</B> · Floor {floor}. Tap another room, or pick a floor.</>)
    : <>Floor {floor} plan · tap a room to highlight it{r && r.floor !== floor ? ` · ${hlName} is on Floor ${r.floor}` : ""}</>;
  const statusEl = <p className="small" role="status">{status}</p>;
  const rest = (
    <details className="floor-rooms"><summary>Rooms on Floor {floor} <span className="small">({ok.length}{todo.length ? ` · ${todo.length} to confirm` : ""})</span></summary>
      <div className="fr-list">{ok.map(([k, x]) => <button key={k} className={`fr-item${x === hlR ? " on" : ""}`} aria-pressed={x === hlR} onClick={() => go(`${base}&sel=${enc(k)}`)}>{label(k)}</button>)}
        {todo.map(([k, x]) => <span key={k} className="fr-item todo" title={x.note || ""}>{label(k)} <i>to confirm</i></span>)}</div></details>
  );
  const enlarge = full ? null : <Link className="plan-zoom" to={`/map/floor/${id}?floor=${floor}${keep}${sel ? `&sel=${enc(sel)}` : ""}`} aria-label={`Enlarge the Floor ${floor} plan`}><I n="plus" /><span>Enlarge</span></Link>;
  return { planEl, statusEl, rest, enlarge };
}

/* ---------- 20 / 21 / 28 place: building card, room or office on its floor plan ---------- */
export function Place() {
  const { id = "" } = useParams(), [p] = useSearchParams(), { S, set } = useWF(), loc = useLocation(), wide = useWide();
  const pl = W.places[id];
  const room = p.get("room"), oid = p.get("office"), office = oid ? W.offices[oid] : null, from = p.get("from");
  useEffect(() => { if (from === "ask") set((d) => { d.from = "/ask/answer"; }); }, [from]); // eslint-disable-line react-hooks/exhaustive-deps
  const floorPlanProps = (() => {
    if (!pl || (!room && !office && !p.get("floor"))) return null;
    const r0 = room ? pl.rooms[room] : null, r = room ? roomOf(pl, room) : office && office.room ? roomOf(pl, office.room) : null;
    const hlName = room || (office ? office.short || office.name : "");
    const floor = +(p.get("floor") || (r ? r.floor : r0 && r0.floor ? r0.floor : office ? office.floor || pl.floors[0] || 0 : pl.floors[0] || 0));
    const sel = !r || r.floor !== floor ? p.get("sel") : null, selR = sel ? roomOf(pl, sel) : null;
    const hlR = r && r.floor === floor ? r : selR && selR.floor === floor ? selR : null, hlKey = hlR === r ? hlName : sel;
    const keep = `${room ? `&room=${enc(room)}` : ""}${oid ? `&office=${oid}` : ""}${from === "route" ? "&from=route" : ""}`;
    return { r0, r, hlName, floor, sel, hlR, hlKey, keep, plan: pl.plans && pl.plans[floor] };
  })();
  const fp = useFloorPlan(floorPlanProps && floorPlanProps.plan ? { id, pl, floor: floorPlanProps.floor, plan: floorPlanProps.plan, hlR: floorPlanProps.hlR, hlKey: floorPlanProps.hlKey, isDest: !!(floorPlanProps.r && floorPlanProps.hlR === floorPlanProps.r), keep: floorPlanProps.keep, picked: p.get("pick") === "1", r: floorPlanProps.r, hlName: floorPlanProps.hlName, sel: floorPlanProps.sel }
    : { id, pl: pl || { rooms: {}, name: "" }, floor: 0, plan: { src: "", w: 1, h: 1 }, hlR: null, hlKey: null, isDest: false, keep: "", picked: false, r: null, hlName: "" });
  const tap = useTapShape(), nav = useNavigateReplace();
  if (!pl) return <MapHome />;
  const guest = !S.signed;
  const fromRoute = from === "route", fromProcess = from === "process" && p.get("pid"), fromOffice = from === "office" && office, fromStops = from === "stops" && p.get("pid");
  const fromClass = from === "class";
  const route = routeFor(S.start?.id, id);
  const backTo = fromStops ? `/map/stops?pid=${p.get("pid")}` : fromProcess ? `/directory/process/${p.get("pid")}?step=${p.get("step") || 0}` : fromOffice ? `/directory/office/${oid}` : fromRoute ? routeHref({ from: "cict-building", to: id }, "done") : from === "ask" || (S.from === "/ask/answer" && from !== "map" && !fromRoute) ? "/ask/answer" : fromClass ? null : "/map";
  const backLabel = fromStops ? "All stops" : fromProcess ? `Back to ${W.processes[p.get("pid")!].short} steps` : fromOffice ? W.offices[oid!].name : fromRoute ? "Route" : fromClass ? "Class" : backTo === "/ask/answer" ? "Answer" : "Map";
  const opening = !p.get("floor") && !p.get("settled");
  const mapEl = <CampusMap pad={wide ? PANEL_PAD : undefined} reserve={wide ? [PANEL_KEEP] : [{ x: 0, y: 0, w: 220, h: 70 }]} focus={pl.shape} sel={pl.shape} start={S.start ? { pt: startPt(S) } : null} startShape={S.start?.shape} entrance={pl.entrance === "approximate" && id === "quezon-hall" ? CAMPUS.points.qhEntrance : null} onTapShape={tap} />;
  const topBar = <div className="map-top"><div className="row"><BackPill to={backTo} label={backLabel} /></div></div>;

  /* 20 · compact building card */
  if (!room && !office && !p.get("floor")) {
    const planHref = pl.plans ? (id === "quezon-hall" ? `/map/place/${id}?floor=1&room=QH%201` : `/map/place/${id}?floor=${pl.floors[0]}`) : (pl.blueprints || []).length || pl.shape ? `/map/blueprint/${id}` : null;
    const planLabel = pl.plans || (pl.blueprints || []).length ? "View floor plan" : "View outline";
    const offices = Object.values(W.offices).filter((o: any) => o.place === id);
    return (
      <section className={`view${guest ? "" : " has-tabs"}`}>
        <div className="map-wrap">{mapEl}</div>{topBar}
        <div className={`map-sheet compact${opening ? " open" : ""}`} key={loc.key}>
          <div className="grab" />
          {pl.photo && <div className="bphoto"><img src={asset(pl.photo.src)} alt={pl.name} width={pl.photo.w} height={pl.photo.h} style={pl.photo.focus ? { objectPosition: pl.photo.focus } : undefined} />
            {pl.photo.credit && <a className="ph-credit" href={pl.photo.credit.url} target="_blank" rel="noopener">{pl.photo.credit.text}</a>}</div>}
          <div className="row" style={{ alignItems: "flex-start" }}><div className="stack" style={{ flex: 1, gap: 3, minWidth: 0 }}>
            <p className="label">BUILDING</p><h1 className="h1" style={{ fontSize: 26 }}>{pl.name}</h1>
            <p className="small clamp2">{pl.about || (offices.length ? `${offices.length} offices` : pl.note || "No details recorded yet.")}</p></div>
            <span className="pill gold"><Needle size={16} /> Selected</span></div>
          {S.start && (route ? <Link className="routechip" to={routeHref(route)}><span className="dot-start" aria-hidden="true" /><span className="grow"><b>From {startText(S)}</b><span className="small">Route preview ready</span></span><I n="chev" cls="ico chev" /></Link>
            : <p className="small startline"><I n="target" /><span><b>From {startText(S)}.</b> Walkway not surveyed{pl.entrance === "approximate" ? " · head for the approximate entrance" : ""}.</span></p>)}
          <div className="two-btn">
            <Link className="btn primary" to={`/map/start?for=${id}`}><I n="route" /> Directions</Link>
            {planHref ? <Link className="btn outline" to={planHref}>{planLabel}</Link> : <span className="btn outline is-off" aria-disabled="true">No floor plan yet</span>}
          </div></div>
        {!guest && <Tabs on="Map" />}<Toast />
      </section>
    );
  }

  const { r0, r, hlName, floor, keep } = floorPlanProps!;
  const destTitle = room || (office ? office.name : pl.name), roomUnconfirmed = !!room && !r;
  const hereCard = !fromRoute && !S.start && id !== "cict-building" && routeFor("cict-building", id) && (fromProcess || fromStops || fromOffice || office || id === "administration");
  return (
    <section className={`view${guest ? "" : " has-tabs"}`}>
      <div className="map-wrap">{mapEl}</div>{topBar}
      <div className={`map-sheet${opening ? " open" : ""}`} style={{ maxHeight: `${guest ? 72 : 66}%` }}>
        <div className="grab" />
        <div className="stack gap-12">
          <div className="row" style={{ alignItems: "flex-start" }}><div className="stack" style={{ flex: 1, gap: 4 }}>
            <p className="label">{office ? "OFFICE" : room ? pl.name.toUpperCase() : "BUILDING"}</p>
            <h1 className={room ? "room" : "h1"} style={room ? undefined : { fontSize: 26 }}>{destTitle}{office && <span className="of-floor"> · {office.floor ? `Floor ${office.floor}` : "floor not confirmed"}</span>}</h1>
            {roomUnconfirmed ? <p className="conf"><I n="check" /> {pl.name} · confirmed</p>
              : <p className="small">{room ? `Floor ${r.floor}${r.where && /,/.test(r.where) ? ` · ${r.where.replace(/^Floor \d+, /, "")}` : ` · ${pl.name}`}` : office ? pl.name : pl.about || "No details recorded yet."}</p>}</div>
            {(room || office) && <span className="pill gold"><Needle size={16} /> Destination</span>}</div>
          {roomUnconfirmed && <p className={`note warn${pl.plans ? "" : " oneline"}`}><I n="info" /><span>{r0 && r0.floor ? `${room} is on Floor ${r0.floor} of ${pl.name}. Its outline on the plan still needs confirming, so it isn’t highlighted.` : `${room} is in ${pl.name}. Its floor hasn’t been confirmed.`}{pl.plans ? " Browse the floors below." : ""}</span></p>}
          {(!roomUnconfirmed || pl.plans) && pl.floors.length > 1 && <div className="seg" role="group" aria-label="Floor">{pl.floors.map((f: number) => <button key={f} aria-pressed={f === floor} onClick={() => nav(`/map/place/${id}?floor=${f}${keep}`)}>Floor {f}</button>)}</div>}
          {!roomUnconfirmed && r && r.floor !== floor && <div className="return-row"><span className="small" style={{ flex: 1 }}><b style={{ color: "var(--ink)" }}>{hlName}</b> is on Floor {r.floor}</span><button className="btn sm primary" onClick={() => nav(`/map/place/${id}?floor=${r.floor}${keep}`)}><I n="back" /> Return to Floor {r.floor}</button></div>}
          {roomUnconfirmed && !pl.plans ? null : floorPlanProps!.plan && pl.floors.length ? <>{fp.planEl}<div className="plan-foot">{fp.statusEl}{fp.enlarge}</div>{fp.rest}</>
            : (pl.blueprints || []).length ? <Link className="bp-card" to={`/map/blueprint/${id}?${office ? `office=${oid}` : ""}`}><img src={asset(pl.blueprints[0].src)} alt="" /><span className="grow"><span className="h3">Building blueprint</span><span className="small">{office ? `${office.name}: ${office.floor ? `Floor ${office.floor}` : "floor not confirmed"}. ` : ""}{pl.blueprints.length} sheet{pl.blueprints.length > 1 ? "s" : ""}</span></span><I n="chev" cls="ico chev" /></Link>
            : pl.floors.length ? <div className="card dashed" style={{ padding: 14 }}><p className="h3">Floor plan not published yet</p><p className="small" style={{ marginTop: 4 }}>{office ? (office.floor ? `${office.name} is on Floor ${office.floor}.` : `${office.name} is in ${pl.name}. Its floor isn’t confirmed yet.`) : "Rooms will appear here once the plan is checked."}</p></div> : null}
          {office && <div className="list">{Object.entries(W.offices).filter(([, o]: [string, any]) => o.place === id && (o.floor === floor || !o.floor)).map(([k, o]: [string, any]) => <Link key={k} className="item" to={`/directory/office/${k}`} style={{ minHeight: 52 }}><span className="grow"><span className="h3" style={{ fontSize: 15 }}>{o.name}</span></span>{k === oid && <span className="pill gold">Here</span>}</Link>)}</div>}
          {hereCard && <div className="card here-card"><p className="here-line"><span className="here-dot" aria-hidden="true" />You are here in CICT. Find your route.</p>
            <Link className="btn primary wide" to={`/map/route?from=cict-building&to=${id}${office ? `&office=${oid}` : ""}`}><I n="route" /> Find your route</Link></div>}
          {!(fromRoute || hereCard) && (room || id === "quezon-hall" || office) && (
            <div className="card" style={{ padding: 14 }}><div className="row"><span style={{ color: "var(--blue)" }}><I n="target" /></span><div className="stack" style={{ flex: 1, gap: 2 }}><p className="label">STARTING FROM</p><p className="h3">{startText(S)}</p></div>
              <Link className="btn sm outline" to={`/map/start?for=${id}${room ? `&room=${enc(room)}` : ""}${office ? `&office=${oid}` : ""}`}>{S.start ? "Change" : "Choose"}</Link></div>
              {S.start && S.start.id === id ? <p className="small" style={{ marginTop: 10 }}>You’re starting at {pl.name}.</p> : S.start ? (route ? <Link className="btn primary wide" style={{ marginTop: 12 }} to={routeHref(route)}><I n="route" /> Show route from {startText(S)}</Link>
                : <div className="note" style={{ marginTop: 12, background: "var(--sand)", color: "var(--body)" }}><I n="info" /><span><b style={{ color: "var(--ink)" }}>Walkway not surveyed.</b> We can’t draw a walking route yet. {pl.entrance === "approximate" ? "Head for the approximate entrance shown on the map." : `Head for ${pl.name}.`}</span></div>) : null}</div>)}
        </div></div>
      {!guest && <Tabs on="Map" />}<Toast />
    </section>
  );
}
function useNavigateReplace() { const nav = useNavigate(); return (h: string) => nav(h, { replace: true }); }
function BackPill({ to, label }: { to: string | null; label: string }) {
  const nav = useNavigate();
  return to ? <Link className="btn sm map-back" to={to}><I n="back" /> {label}</Link> : <button className="btn sm map-back" type="button" onClick={() => nav(-1)}><I n="back" /> {label}</button>;
}

/* ---------- 21B / 34F full-screen floor plan with zoom ---------- */
export function FloorView() {
  const { id = "" } = useParams(), [p] = useSearchParams(), { S } = useWF(), nav = useNavigateReplace();
  const pl = W.places[id];
  const room = p.get("room"), oid = p.get("office"), office = oid ? W.offices[oid] : null;
  const r0 = pl && room ? pl.rooms[room] : null, r = pl && room ? roomOf(pl, room) : pl && office && office.room ? roomOf(pl, office.room) : null;
  const hlName = room ? (r0 && r0.name) || room : office ? office.short || office.name : "";
  const floor = pl ? +(p.get("floor") || (r ? r.floor : r0 && r0.floor) || pl.floors[0]) : 0, plan = pl && pl.plans ? pl.plans[floor] || pl.plans[pl.floors[0]] : null;
  const wide = plan ? plan.w / plan.h > 1.7 : false, z = Math.max(1, Math.min(3, +(p.get("z") || (wide ? 2 : 1.5))));
  const keep = `${room ? `&room=${enc(room)}` : ""}${oid ? `&office=${oid}` : ""}`;
  const sel = !r || r.floor !== floor ? p.get("sel") : null, selR = sel && pl ? roomOf(pl, sel) : null;
  const hlR = r && r.floor === floor ? r : selR && selR.floor === floor ? selR : null, hlKey = hlR === r ? hlName : sel;
  const fp = useFloorPlan({ id, pl: pl || { rooms: {} }, floor, plan: plan || { src: "", w: 1, h: 1 }, hlR, hlKey, isDest: !!(r && hlR === r), keep: `${keep}&z=${z}`, picked: p.get("pick") === "1", r, hlName, full: true, sel });
  const frame = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const fr = frame.current, h = fr && fr.querySelector(".plan .hl"); if (!fr || !h) return; const a = h.getBoundingClientRect(), b = fr.getBoundingClientRect(); fr.scrollLeft += a.left + a.width / 2 - (b.left + b.width / 2); fr.scrollTop += a.top + a.height / 2 - (b.top + b.height / 2); }, [floor, z, hlKey]);
  if (!pl || !plan) return <Place />;
  const zq = (v: number) => `/map/floor/${id}?floor=${floor}${keep}${sel ? `&sel=${enc(sel)}` : ""}&z=${v}`;
  const back = `/map/place/${id}?floor=${floor}${keep}${sel ? `&sel=${enc(sel)}` : ""}&settled=1`;
  return (
    <section className={`view${S.signed ? " has-tabs" : ""} fview`}><Bar title={`Floor ${floor}`} back={back} backLabel={pl.name} onBack={() => nav(back)} />
      <div className="scroll" style={{ top: 60 }}><div className="pad stack gap-12" style={{ paddingBottom: 20 }}>
        {pl.floors.length > 1 && <div className="seg" role="group" aria-label="Floor">{pl.floors.map((f: number) => <button key={f} aria-pressed={f === floor} onClick={() => nav(`/map/floor/${id}?floor=${f}${keep}&z=${z}`)}>Floor {f}</button>)}</div>}
        {r && r.floor !== floor && <div className="return-row"><span className="small" style={{ flex: 1 }}><b style={{ color: "var(--ink)" }}>{hlName}</b> is on Floor {r.floor}</span><button className="btn sm primary" onClick={() => nav(`/map/floor/${id}?floor=${r.floor}${keep}&z=${z}`)}><I n="back" /> Return to Floor {r.floor}</button></div>}
        <div className="fv-frame" id="fvframe" ref={frame}><div className="fv-inner" style={{ width: `${z * 100}%` }}>{fp.planEl}</div></div>
        <div className="bp-zoom" role="group" aria-label="Zoom"><button className="icon-btn" onClick={() => nav(zq(Math.max(1, z - 0.5)))} aria-label="Zoom out" disabled={z <= 1}><I n="minus" /></button><span className="small" aria-live="polite">{Math.round(z * 100)}%</span><button className="icon-btn" onClick={() => nav(zq(Math.min(3, z + 0.5)))} aria-label="Zoom in" disabled={z >= 3}><I n="plus" /></button></div>
        {fp.statusEl}{fp.rest}
      </div></div>{S.signed && <Tabs on="Map" />}</section>
  );
}

/* ---------- 26E–26G blueprint viewer, or the traced outline when there's no blueprint ---------- */
const M_PER_UNIT = 110600 / 70245.1; // campus map units → metres
export function Blueprint() {
  const { id = "" } = useParams(), [p] = useSearchParams(), { S } = useWF(), nav = useNavigateReplace();
  const pl = W.places[id]; if (!pl) return <MapHome />;
  const off = p.get("office") ? W.offices[p.get("office")!] : null;
  const back = off ? `/map/place/${id}?office=${p.get("office")}&settled=1` : `/map/place/${id}?settled=1`;
  if (!(pl.blueprints || []).length) return <Outline id={id} back={back} />;
  const i = Math.min(+(p.get("i") || 0), pl.blueprints.length - 1), z = Math.max(1, Math.min(3, +(p.get("z") || 1))), bp = pl.blueprints[i];
  const q = (k: string, v: number) => { const n = new URLSearchParams(p); n.set(k, String(v)); return `/map/blueprint/${id}?${n}`; };
  return (
    <section className={`view${S.signed ? " has-tabs" : ""} bpview`}><Bar title="Floor plan" back={back} backLabel={off ? off.short || off.name : pl.name} />
      <div className="scroll" style={{ top: 60 }}><div className="pad stack gap-12" style={{ paddingBottom: 20 }}>
        <header className="bp-head">{pl.photo ? <img className="bp-thumb" src={asset(pl.photo.src)} alt="" /> : <Silhouette shape={pl.shape} size={48} />}<div className="grow"><h1 className="h2">{pl.name}</h1><p className="small">{off ? `${off.name} · ${off.floor ? `Floor ${off.floor}` : "floor not confirmed"}` : `${pl.blueprints.length} sheet${pl.blueprints.length > 1 ? "s" : ""} from the team’s blueprints`}</p></div></header>
        {pl.blueprints.length > 1 && <div className="seg" role="group" aria-label="Sheet">{pl.blueprints.map((b2: any, k: number) => <button key={k} aria-pressed={k === i} onClick={() => nav(q("i", k))}>{b2.label || `Sheet ${k + 1}`}</button>)}</div>}
        {pl.blueprints.length === 1 && bp.label && <p className="label">{bp.label}</p>}
        <div className="bp-frame"><div className="bp-inner" style={{ width: `${z * 100}%` }}><img src={asset(bp.src)} alt={`${pl.name} blueprint, sheet ${i + 1}`} width={bp.w} height={bp.h} /></div></div>
        <div className="bp-zoom" role="group" aria-label="Zoom"><button className="icon-btn" onClick={() => nav(q("z", Math.max(1, z - 0.5)))} aria-label="Zoom out" disabled={z <= 1}><I n="minus" /></button><span className="small">{Math.round(z * 100)}%</span><button className="icon-btn" onClick={() => nav(q("z", Math.min(3, z + 0.5)))} aria-label="Zoom in" disabled={z >= 3}><I n="plus" /></button></div>
        <p className="small">Blueprint from the team’s records. Room positions on it haven’t been checked yet{pl.rooms && pl.rooms["QH 1"] ? ", except QH 1" : ""}.</p>
      </div></div>{S.signed && <Tabs on="Map" />}</section>
  );
}
function Outline({ id, back }: { id: string; back: string }) {
  const { S } = useWF(), pl = W.places[id], sh = pl.shape && shapeBy(pl.shape);
  const shell = (body: ReactNode) => <section className={`view${S.signed ? " has-tabs" : ""} bpview`}><Bar title="Floor plan" back={back} backLabel={pl.name} /><div className="scroll" style={{ top: 60 }}><div className="pad stack gap-12" style={{ paddingBottom: 20 }}>{body}</div></div>{S.signed && <Tabs on="Map" />}</section>;
  if (!sh) return shell(<><h1 className="h2">{pl.name}</h1><div className="card dashed"><p className="h3">Not on the campus map yet</p><p className="small" style={{ marginTop: 4 }}>{pl.note || "This building has no outline or floor plan yet."}</p></div></>);
  const nums = (sh.d.match(/-?\d+(\.\d+)?/g) || []).map(Number), pts: number[][] = []; for (let k = 0; k < nums.length; k += 2) pts.push([nums[k], nums[k + 1]]);
  const ring = pts.filter((q, k) => k === 0 || Math.hypot(q[0] - pts[k - 1][0], q[1] - pts[k - 1][1]) > 0.05);
  const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), bw = Math.max(...xs) - x0, bh = Math.max(...ys) - y0;
  const pad = Math.max(bw, bh) * 0.22, vb = [x0 - pad, y0 - pad, bw + 2 * pad, bh + 2 * pad], u = vb[2] / 320;
  const edges: { a: number[]; b: number[]; len: number }[] = []; for (let k = 0; k < ring.length - 1; k++) { const a = ring[k], b = ring[k + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]) * M_PER_UNIT; if (len >= 6) edges.push({ a, b, len }); }
  const cxp = xs.reduce((t, v) => t + v, 0) / xs.length, cyp = ys.reduce((t, v) => t + v, 0) / ys.length;
  const area = Math.abs(ring.reduce((t, q, k) => { const r2 = ring[(k + 1) % ring.length]; return t + q[0] * r2[1] - r2[0] * q[1]; }, 0) / 2) * M_PER_UNIT * M_PER_UNIT;
  const grid: ReactNode[] = []; for (let gx = Math.ceil(vb[0] / 10) * 10; gx < vb[0] + vb[2]; gx += 10) grid.push(<path key={`x${gx}`} d={`M${gx} ${vb[1]} V${vb[1] + vb[3]}`} />); for (let gy = Math.ceil(vb[1] / 10) * 10; gy < vb[1] + vb[3]; gy += 10) grid.push(<path key={`y${gy}`} d={`M${vb[0]} ${gy} H${vb[0] + vb[2]}`} />);
  return shell(<>
    <header className="bp-head">{pl.photo ? <img className="bp-thumb" src={asset(pl.photo.src)} alt="" /> : <Silhouette shape={pl.shape} size={48} />}<div className="grow"><h1 className="h2">{pl.name}</h1><p className="small">No floor plan yet · outline from the campus map</p></div></header>
    <div className="outline-frame"><svg viewBox={vb.map((v) => v.toFixed(2)).join(" ")} role="img" aria-label={`${pl.name} outline, about ${Math.round(bw * M_PER_UNIT)} by ${Math.round(bh * M_PER_UNIT)} metres`}>
      <g stroke="#E6DCC8" strokeWidth={(0.6 * u).toFixed(2)} fill="none">{grid}</g>
      <path d={sh.d} fill="#FCEBC4" stroke="#132D6B" strokeWidth={(2.2 * u).toFixed(2)} strokeLinejoin="round" />
      {ring.map((q, k) => <circle key={k} cx={q[0]} cy={q[1]} r={(2.6 * u).toFixed(2)} fill="#132D6B" />)}
      {edges.sort((e1, e2) => e2.len - e1.len).slice(0, 4).map(({ a, b, len }, k) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = mx - cxp, ny = my - cyp, nl = Math.hypot(nx, ny) || 1, ox = mx + (nx / nl) * 14 * u, oy = my + (ny / nl) * 14 * u;
        return <g key={k}><rect x={(ox - 22 * u).toFixed(2)} y={(oy - 9 * u).toFixed(2)} width={(44 * u).toFixed(2)} height={(18 * u).toFixed(2)} rx={(6 * u).toFixed(2)} fill="#FFFBF3" stroke="#D5C8AE" strokeWidth={(1 * u).toFixed(2)} /><text x={ox.toFixed(2)} y={(oy + 4.2 * u).toFixed(2)} textAnchor="middle" fontFamily="Fira Sans, sans-serif" fontWeight="700" fontSize={(11.5 * u).toFixed(2)} fill="#132D6B">≈ {Math.round(len)} m</text></g>; })}
      <g transform={`translate(${(vb[0] + vb[2] - 26 * u).toFixed(2)} ${(vb[1] + 26 * u).toFixed(2)})`}><path d={`M0 ${(-12 * u).toFixed(2)} L${(6 * u).toFixed(2)} ${(6 * u).toFixed(2)} L0 ${(2 * u).toFixed(2)} L${(-6 * u).toFixed(2)} ${(6 * u).toFixed(2)} Z`} fill="#132D6B" /><text y={(18 * u).toFixed(2)} textAnchor="middle" fontFamily="Fira Sans, sans-serif" fontWeight="700" fontSize={(10 * u).toFixed(2)} fill="#132D6B">N</text></g>
    </svg></div>
    <div className="outline-facts"><div><span className="label">Footprint</span><b>≈ {Math.round(area).toLocaleString()} m²</b></div><div><span className="label">Size</span><b>≈ {Math.round(bw * M_PER_UNIT)} × {Math.round(bh * M_PER_UNIT)} m</b></div><div><span className="label">Corners</span><b>{ring.length - 1}</b></div></div>
    <Link className="btn outline wide" to={back}><I n="map" /> Show on map</Link>
    <p className="small">Outline traced from the team’s MapTiler campus map. Sizes are approximate (±2 m). {pl.note || "Floors and rooms will appear here once a blueprint is added."}</p>
  </>);
}

/* ---------- 23 start picker: the destination stays visible while the start changes ---------- */
export function StartPicker() {
  const [p] = useSearchParams(), { S, set } = useWF(), nav = useNavigate();
  const forId = p.get("for") || "quezon-hall", pl = W.places[forId];
  const ret = `/map/place/${forId}?settled=1${p.get("room") ? `&room=${enc(p.get("room")!)}` : ""}${p.get("office") ? `&office=${p.get("office")}` : ""}`;
  const [open, setOpen] = useState(p.get("places") === "1" || S.start?.kind === "named");
  const destName = p.get("room") ? `${p.get("room")} · ${pl.name}` : pl.name;
  const pick = (start: State["start"], toast?: string) => { set((d) => { d.start = start; if (toast) d.toast = toast; }); const r = start && start.kind === "named" ? routeFor(start.id, forId) : null; nav(r ? routeHref(r) : ret, { replace: true }); };
  return (
    <section className="view has-tabs">
      <div className="map-wrap"><CampusMap focus={pl.shape} sel={pl.shape} start={S.start ? { pt: startPt(S) } : null} startShape={S.start?.shape} /></div>
      <Link className="scrim" to={ret} replace aria-label="Close" />
      <div className="sheet start-sheet" role="dialog" aria-modal="true" aria-label="Choose a starting point"><div className="grab" />
        <div className="row" style={{ marginBottom: 10 }}><h2 className="h2" style={{ flex: 1 }}>Directions</h2><Link className="icon-btn" to={ret} replace aria-label="Close"><I n="x" /></Link></div>
        <div className="destrow"><span className="needle"><Needle size={18} /></span><span className="grow"><span className="label">TO</span><span className="h3">{destName}</span></span><span className="pill gold">Destination</span></div>
        <p className="label" style={{ margin: "14px 0 8px" }}>WHERE ARE YOU STARTING?</p>
        <div className="list">
          <button className="item" onClick={() => pick({ kind: "gps", label: "Your location", pt: [196, 300] }, toastHtml("Using your location · ±18 m"))}><span style={{ color: "var(--blue)" }}><I n="gps" /></span><span className="grow"><span className="h3">Use my location</span><span className="small">Uses your phone’s GPS once</span></span></button>
          <button className="item" aria-expanded={open} aria-controls="placelist" onClick={() => setOpen(!open)}><span style={{ color: "var(--navy-2)" }}><I n="flag" /></span><span className="grow"><span className="h3">Choose a campus place</span><span className="small">{S.start?.kind === "named" ? `Now: ${S.start.label}` : "CICT Building, Main Gate, Library…"}</span></span><I n="caret" cls="ico caret" /></button>
          <div className="placelist" id="placelist" hidden={!open}>{W.starts.map((st: any) => (
            <button key={st.id} className="item sub" onClick={() => pick({ kind: "named", ...st })}><span className="grow"><span className="h3" style={{ fontSize: 15.5 }}>{st.label}</span>{routeFor(st.id, forId) && <span className="small">Route preview available</span>}</span>{S.start?.id === st.id ? <span className="pill ok"><I n="check" /> Current</span> : <I n="chev" cls="ico chev" />}</button>))}</div>
          <Link className="item" to={`/map/pin?for=${forId}${p.get("room") ? `&room=${enc(p.get("room")!)}` : ""}`}><span style={{ color: "var(--navy-2)" }}><I n="pin" /></span><span className="grow"><span className="h3">Pick on map</span><span className="small">Drop a pin where you are</span></span><I n="chev" cls="ico chev" /></Link>
        </div></div>
    </section>
  );
}

/* ---------- 24 pick a point ---------- */
export function PinPicker() {
  const [p] = useSearchParams(), { S, set } = useWF(), nav = useNavigate();
  const forId = p.get("for") || "quezon-hall", ret = `/map/place/${forId}?settled=1${p.get("room") ? `&room=${enc(p.get("room")!)}` : ""}`;
  return (
    <section className="view">
      <div className="map-wrap"><CampusMap pin={S.pinPt} sel={W.places[forId].shape} noNeedle onTapMap={(pt) => set((d) => { d.pinPt = pt; })} /></div>
      <div className="map-top"><div className="row"><Link className="btn sm" to={ret} style={{ background: "var(--cream)", color: "var(--navy-2)", boxShadow: "0 6px 18px rgba(60,40,0,.14)" }}><I n="back" /> Cancel</Link></div></div>
      <div className="map-sheet" style={{ maxHeight: "none" }}><div className="grab" />
        <p className="h2">{S.pinPt ? "Is this where you are?" : "Tap where you are"}</p>
        <p className="small" style={{ marginTop: 4 }}>{S.pinPt ? "Tap again to move the pin." : "Tap the map to drop a pin."}</p>
        <button className="btn primary wide" disabled={!S.pinPt} style={{ marginTop: 14, opacity: S.pinPt ? 1 : 0.45 }} onClick={() => { set((d) => { d.start = { kind: "pin", label: "Point on the map", pt: d.pinPt || undefined }; d.toast = toastHtml("Starting from your pin"); }); nav(ret, { replace: true }); }}>Use this point</button></div>
    </section>
  );
}

/* ---------- 25A–25E route walk: the arrow follows the traced walkway, turn by turn ---------- */
const RT = { segMs: [820, 700, 720, 1500, 980], turnMs: [460, 460, 260, 260], hold: 320, tail: 140 };
function routeGeom(r: any) {
  const P: number[][] = r.pts, seg: number[] = [], ang: number[] = [], cum = [0];
  for (let i = 0; i < P.length - 1; i++) { const dx = P[i + 1][0] - P[i][0], dy = P[i + 1][1] - P[i][1]; seg.push(Math.hypot(dx, dy)); ang.push(Math.atan2(dy, dx) * 180 / Math.PI); cum.push(cum[i] + seg[i]); }
  const ph: { k: string; i: number; t0: number; t1: number }[] = []; let t = RT.hold;
  const tuned = r === W.routes["cict-building>quezon-hall"], segMs = (i: number) => (tuned || (r.zigzag && i < 3) ? RT.segMs[i] : Math.round(Math.max(520, Math.min(1800, seg[i] * 23))));
  const turnMs = (i: number) => (tuned || (r.zigzag && i < 2) ? RT.turnMs[i] : 300);
  for (let i = 0; i < seg.length; i++) { ph.push({ k: "move", i, t0: t, t1: (t += segMs(i)) }); if (i < seg.length - 1) ph.push({ k: "turn", i, t0: t, t1: (t += turnMs(i)) }); }
  return { P, seg, ang, cum, L: cum[cum.length - 1], ph, total: t + RT.tail, turns: seg.length - 1 };
}
type Geom = ReturnType<typeof routeGeom>;
const easeIO = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const lerpAng = (a: number, b: number, f: number) => a + (((b - a + 540) % 360) - 180) * f;
function routeAt(g: Geom, t: number) {
  if (t <= RT.hold) return { drawn: 0, ang: g.ang[0], passed: 0, phase: "hold" };
  for (const ph of g.ph) {
    if (t > ph.t1) continue;
    const f = easeIO(Math.max(0, Math.min(1, (t - ph.t0) / (ph.t1 - ph.t0))));
    if (ph.k === "move") return { drawn: g.cum[ph.i] + g.seg[ph.i] * f, ang: g.ang[ph.i], passed: ph.i, phase: "move" };
    return { drawn: g.cum[ph.i + 1], ang: lerpAng(g.ang[ph.i], g.ang[ph.i + 1], f), passed: ph.i, phase: "turn" };
  }
  return { drawn: g.L, ang: g.ang[g.ang.length - 1], passed: g.turns, phase: "end" };
}
function pointAt(g: Geom, d: number) {
  d = Math.max(0, Math.min(g.L, d)); let i = 0; while (i < g.seg.length - 1 && d > g.cum[i + 1]) i++;
  const f = g.seg[i] ? (d - g.cum[i]) / g.seg[i] : 0, a = g.P[i], b = g.P[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
const routeStatus = (g: Geom, st: ReturnType<typeof routeAt>, r: any) => st.phase === "end" ? `You’re at the ${r.toLabel}.${r.room ? ` ${r.room} is on Floor ${(W.places[r.to].rooms[r.room] || {}).floor || 1}.` : r.note ? ` ${r.note}` : ""}`
  : st.phase === "hold" ? `Leaving ${r.fromLabel}` : r.zigzag && st.passed < 2 ? `Zigzag out of CICT · turn ${st.passed + 1} of ${g.turns}`
  : st.passed < g.turns ? `Turn ${st.passed + 1} of ${g.turns}${st.phase === "turn" ? "" : " ahead"}` : `Last stretch to the ${r.toLabel}`;

export function RouteView() {
  const [p, setP] = useSearchParams(), { S, set, reduced } = useWF();
  const r = routeFor(p.get("from"), p.get("to")) || W.routes["cict-building>quezon-hall"];
  const from = W.places[r.from], to = W.places[r.to], st0 = W.starts.find((x: any) => x.id === r.from);
  const g = useRef(routeGeom(r)).current;
  const room = p.get("room"), oid = p.get("office");
  const rOff = oid && W.offices[oid] && W.offices[oid].place === r.to ? W.offices[oid] : null;
  const guest = !S.signed;
  const initial = (["play", "done"].includes(p.get("walk") || "") ? p.get("walk") : "idle") as "idle" | "play" | "done";
  const [state, setState] = useState<"idle" | "play" | "done">(initial === "play" ? "done" : initial);
  const [st, setSt] = useState(() => (state === "done" ? routeAt(g, g.total) : { drawn: g.L, ang: g.ang[0], passed: 0, phase: "idle" }));
  const [view, setView] = useState<{ x0: number; y0: number; w: number; h: number; k: number; panned: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null), top = useRef<HTMLDivElement>(null), sheet = useRef<HTMLDivElement>(null);
  useEffect(() => { if (st0) set((d) => { d.start = { kind: "named", ...st0 }; }); }, [r.from]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fit the whole route between the top bar and the sheet.
  const fit = () => {
    const w = wrap.current, tb = top.current, sh = sheet.current; if (!w || !tb || !sh) return;
    const W0 = w.offsetWidth, H0 = w.offsetHeight, fa = freeArea(w, tb, sh), t0 = fa.t, b0 = fa.b;
    const xs = g.P.map((q) => q[0]), ys = g.P.map((q) => q[1]), bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
    const m = { l: 70, r: 44, t: 40, b: 46 }, k = Math.min((fa.r - fa.l - m.l - m.r) / (bx1 - bx0), (b0 - t0 - m.t - m.b) / (by1 - by0), 6);
    const ax = (fa.l + m.l + fa.r - m.r) / 2, ay = (t0 + m.t + b0 - m.b) / 2;
    setView({ k, x0: +((bx0 + bx1) / 2 - ax / k).toFixed(2), y0: +((by0 + by1) / 2 - ay / k).toFixed(2), w: +(W0 / k).toFixed(2), h: +(H0 / k).toFixed(2), panned: false });
  };
  useLayoutEffect(() => { fit(); if (typeof ResizeObserver === "undefined") return; const ro = new ResizeObserver(() => fit()); if (wrap.current) ro.observe(wrap.current); return () => ro.disconnect(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setWalk = (s: "idle" | "play" | "done") => { setState(s); const n = new URLSearchParams(p); if (s === "idle") n.delete("walk"); else n.set("walk", s); setP(n, { replace: true }); };
  useEffect(() => {
    if (state !== "play") return;
    if (reduced) { setSt(routeAt(g, g.total)); setWalk("done"); return; }
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => { const t = now - t0; setSt(routeAt(g, t)); if (t < g.total) raf = requestAnimationFrame(step); else setWalk("done"); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  // Drag to pan (not while the walk plays).
  const drag = useRef<{ x: number; y: number; x0: number; y0: number; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => { if (state === "play" || !view) return; drag.current = { x: e.clientX, y: e.clientY, x0: view.x0, y0: view.y0, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const d0 = drag.current; if (!d0 || !view) return; const dx = e.clientX - d0.x, dy = e.clientY - d0.y; if (!d0.moved && Math.hypot(dx, dy) < 4) return; d0.moved = true; setView({ ...view, x0: +(d0.x0 - dx / view.k).toFixed(2), y0: +(d0.y0 - dy / view.k).toFixed(2), panned: true }); };
  const k = view ? view.k : 2, px = (v: number) => +(v / k).toFixed(3);
  const d = "M" + g.P.map((q) => q.join(" ")).join(" L"), s0 = g.P[0], e0 = g.P[g.P.length - 1];
  const dash = `${(state === "idle" ? g.L : st.drawn).toFixed(3)} ${(g.L + 10).toFixed(1)}`;
  const offStart = 27 / k, offEnd = 22 / k, drawn = state === "idle" ? g.L : st.drawn;
  const along = state === "idle" ? offStart : Math.max(offStart, Math.min(g.L - offEnd, drawn));
  const q = st.phase === "turn" && state !== "idle" ? pointAt(g, drawn) : pointAt(g, along), ang = state === "idle" ? g.ang[0] : st.ang;
  const msg = state === "idle" ? "Walking route from the team’s sketch · prototype data" : routeStatus(g, st, r);
  const Label = ({ x, y, l1, l2, anchor }: { x: number; y: number; l1: string; l2: string; anchor: string }) => {
    const w = Math.max(l1.length * 7.1, l2.length * 6.2) + 18, h = 36, ox = anchor === "below" ? -w / 2 : anchor === "above-left" ? -w + 6 : -6, oy = anchor === "below" ? 16 : -h - 16;
    return <g className="rlabel" transform={`translate(${x} ${y})`}><rect x={px(ox)} y={px(oy)} width={px(w)} height={px(h)} rx={px(8)} fill="#FFFBF3" stroke="#132D6B" strokeOpacity=".18" strokeWidth={px(1)} />
      <text x={px(ox + 9)} y={px(oy + 15)} fontFamily="Fira Sans, sans-serif" fontSize={px(12.5)} fontWeight="700" fill="#132D6B">{l1}</text><text x={px(ox + 9)} y={px(oy + 29)} fontFamily="Fira Sans, sans-serif" fontSize={px(11)} fontWeight="600" fill="#5A6476">{l2}</text></g>;
  };
  const inner = (
    <g id="Route">
      <path d={d} fill="none" stroke="#FFFBF3" strokeWidth={px(9)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
      <path d={d} fill="none" stroke="#123A9C" strokeWidth={px(5)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
      <g><circle cx={s0[0]} cy={s0[1]} r={px(14)} fill="#2E6FB8" opacity=".18" /><circle cx={s0[0]} cy={s0[1]} r={px(7.5)} fill="#2E6FB8" stroke="#fff" strokeWidth={px(3)} /></g>
      <g transform={`translate(${e0[0]} ${e0[1]})`}><circle r={px(10.5)} fill="#F3B53A" stroke="#132D6B" strokeWidth={px(2.5)} /><rect x={px(-3)} y={px(-4.5)} width={px(6)} height={px(9)} rx={px(1)} fill="#132D6B" /></g>
      <g transform={`translate(${q[0].toFixed(2)} ${q[1].toFixed(2)}) rotate(${ang.toFixed(1)})`}><g transform={`scale(${px(0.27)})`}><path d="M38 0 L-44 -44 L-24 0 Z" fill="#132D6B" /><path d="M38 0 L-24 0 L-44 44 Z" fill="#3F8FD2" /><path d="M38 0 L-44 -44 L-24 0 L-44 44 Z" fill="none" stroke="#FFFBF3" strokeWidth="7" strokeLinejoin="round" /></g></g>
      <Label x={s0[0]} y={s0[1]} l1={r.fromLabel} l2="Start" anchor="below" />
      <Label x={e0[0]} y={e0[1]} l1={r.toShort || to.name} l2="entrance" anchor={e0[0] > s0[0] ? "above-left" : "above-right"} />
    </g>
  );
  const arrival = (() => {
    const rr = r.room && to.rooms[r.room];
    if (rOff) return <Link className="btn primary" to={`/map/place/${r.to}?office=${oid}&from=route`}>Open Floor {rOff.floor || 1}</Link>;
    if (to.plans) { const f = rr ? rr.floor : to.floors[0]; return <Link className="btn primary" to={`/map/place/${r.to}?floor=${f}${r.room ? `&room=${enc(r.room)}` : ""}&from=route`}>Open Floor {f}</Link>; }
    return <Link className="btn primary" to={`/map/place/${r.to}?settled=1&from=route`}>View building</Link>;
  })();
  return (
    <section className={`view route-view${guest ? "" : " has-tabs"}`} data-state={state}>
      <div className="map-wrap" id="routemap" ref={wrap} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        {view && <CampusMap vb={[view.x0, view.y0, view.w, view.h]} sel={to.shape} startShape={from.shape} hide={[from.shape, to.shape]} noNeedle fit inner={inner} />}
      </div>
      <div className="map-top" id="routetop" ref={top}><div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <Link className="btn sm map-back" to={`/map/place/${r.to}?settled=1`}><I n="back" /> {to.name}</Link>
        <span className="destchip"><Needle size={16} /><span>To <b>{room || (rOff ? rOff.short || rOff.name : to.name)}</b>{room ? `, ${to.name}` : ""}</span></span></div></div>
      <button className="fitbtn" type="button" hidden={!view?.panned} onClick={fit} aria-label="Show the whole route" style={sheet.current ? { bottom: "auto", top: sheet.current.offsetTop - 56 } : undefined}><I n="target" /></button>
      <div className="map-sheet route-sheet" id="routesheet" ref={sheet}><div className="grab" />
        <div className="ft"><div className="ft-col"><span className="label">FROM</span><span className="h3"><i className="dot-start" aria-hidden="true" />{r.fromLabel}</span></div>
          <span className="ft-arrow" aria-hidden="true"><I n="arrow" /></span>
          <div className="ft-col"><span className="label">TO</span><span className="h3"><i className="dot-end" aria-hidden="true" />{r.toLabel}</span></div></div>
        <p className="route-status" role="status" aria-live="polite">{msg}</p>
        <div className="route-actions">
          {state === "play" ? <button className="btn outline wide" type="button" onClick={() => { setSt(routeAt(g, g.total)); setWalk("done"); }}>Skip to entrance</button>
            : state === "done" ? <><button className="btn outline" type="button" onClick={() => setWalk("play")}><I n="undo" /> Replay</button>{arrival}</>
            : <><button className="btn primary" type="button" onClick={() => setWalk("play")}><I n="route" /> Preview walk</button><Link className="btn outline" to={`/map/start?for=${r.to}`}>Change start</Link></>}
        </div>
      </div>{!guest && <Tabs on="Map" />}<Toast />
    </section>
  );
}

/* ---------- 28D all stops of a process, in walking order ---------- */
export function Stops() {
  const [p] = useSearchParams(), { S } = useWF();
  const id = W.processes[p.get("pid") || ""] ? p.get("pid")! : "activity", pr = W.processes[id], stops = procStops(pr), done = procDone(S, id), nextStep = nextOf(pr, done);
  const wrap = useRef<HTMLDivElement>(null), top = useRef<HTMLDivElement>(null), sheet = useRef<HTMLDivElement>(null);
  const [vb, setVb] = useState<{ v: number[]; k: number } | null>(null);
  const pts = stops.map((stp) => { const sp = shapeBy(W.places[stp.place].shape); return [sp.cx, sp.cy]; });
  useLayoutEffect(() => {
    const w = wrap.current, tb = top.current, sh = sheet.current; if (!w || !tb || !sh) return;
    const W0 = w.offsetWidth, H0 = w.offsetHeight, fa = freeArea(w, tb, sh, 10), t0 = fa.t, b0 = fa.b;
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), m = 60;
    const bw = Math.max(Math.max(...xs) - Math.min(...xs), 1), bh = Math.max(Math.max(...ys) - Math.min(...ys), 1);
    const k = Math.min((fa.r - fa.l - 2 * m) / bw, (b0 - t0 - 2 * m) / bh, 5.5), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    setVb({ v: [cx - (fa.l + fa.r) / 2 / k, cy - (t0 + b0) / 2 / k, W0 / k, H0 / k], k });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const k = vb ? vb.k : 3, px = (x: number) => +(x / k).toFixed(3);
  const inner = <g>{pts.slice(1).map((q, i) => <line key={`l${i}`} x1={pts[i][0]} y1={pts[i][1]} x2={q[0]} y2={q[1]} stroke="#123A9C" strokeWidth={px(3)} strokeDasharray={`${px(7)} ${px(6)}`} strokeLinecap="round" />)}
    {pts.map((q, i) => { const s2 = stopState(stops[i], done, nextStep), fill = s2 === "done" ? "#13703F" : s2 === "now" ? "#F3B53A" : "#1B3C8A", tc = s2 === "now" ? "#132D6B" : "#fff";
      return <g key={i} className={`stop-pin ${s2}`} transform={`translate(${q[0]} ${q[1]})`}><circle r={px(19)} fill="#FFFBF3" opacity=".92" /><circle r={px(14)} fill={fill} stroke="#fff" strokeWidth={px(2.5)} /><text y={px(4.8)} textAnchor="middle" fontFamily="Fira Sans, sans-serif" fontWeight="800" fontSize={px(14)} fill={tc}>{s2 === "done" ? "✓" : i + 1}</text></g>; })}</g>;
  return (
    <section className={`view${S.signed ? " has-tabs" : ""} stops-view`}>
      <div className="map-wrap" id="stopsmap" ref={wrap}>{vb && <CampusMap vb={vb.v} inner={inner} noNeedle fit hide={stops.map((stp) => W.places[stp.place].shape)} stopShapes={stops.map((stp) => W.places[stp.place].shape)} />}</div>
      <div className="map-top" ref={top}><div className="row"><Link className="btn sm map-back" to={`/directory/process/${id}`}><I n="back" /> Back to {pr.short} steps</Link></div></div>
      <div className="map-sheet stops-sheet" ref={sheet}><div className="grab" />
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}><h2 className="h2">Buildings to walk to</h2><span className="small">{done.length} of {pr.steps.length} steps done</span></div>
        <ProgressBar done={done.length} total={pr.steps.length} label={`${done.length} of ${pr.steps.length} steps done`} />
        <ol className="walk-list compact">{stops.map((stp, i) => { const pl = W.places[stp.place], stt = stopState(stp, done, nextStep);
          return <li key={i}><Link className={`walk-stop ${stt}`} to={`/map/place/${stp.place}?${stp.offices[0] ? `office=${stp.offices[0]}&` : ""}from=stops&pid=${id}&settled=1`}><span className="ws-n">{stt === "done" ? <I n="check" /> : i + 1}</span>
            <span className="grow"><span className="h3">{pl.name}</span><span className="small">Step{stp.steps.length > 1 ? "s" : ""} {stp.steps.join(" and ")}{stp.offices.length ? ` · ${[...new Set(stp.offices)].map(shortOf).join(", ")}` : ""}</span></span>{stt === "now" ? <span className="pill gold">Next</span> : <I n="chev" cls="ico chev" />}</Link></li>; })}</ol>
        <p className="small" style={{ marginTop: 8 }}>Dashed lines show the order of stops, not a surveyed walkway.</p>
      </div>{S.signed && <Tabs on="Map" />}
    </section>
  );
}
