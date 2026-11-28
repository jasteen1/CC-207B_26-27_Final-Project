/* Shared screen chrome: tab bar, Ask button, top bars, toast. */
import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { I, sched, useWF } from "../core";

const TABS: [string, string, (has: boolean) => string][] = [
  ["home", "Home", () => "/home"],
  ["cal", "Schedule", (has) => (has ? "/schedule" : "/scan")],
  ["map", "Map", () => "/map"],
  ["bldg", "Directory", () => "/directory"],
];
let prevTab: number | null = null;

/** Four tabs. A gold circle marks where you are and glides from the tab you left. Ask floats above them (not on Map). */
export function Tabs({ on }: { on: "Home" | "Schedule" | "Map" | "Directory" }) {
  const { S } = useWF();
  const idx = Math.max(0, TABS.findIndex((t) => t[1] === on));
  const from = useRef(prevTab == null ? idx : prevTab).current;
  useEffect(() => { prevTab = idx; }, [idx]);
  return (
    <>
      <nav className="tabs" aria-label="Main" style={{ ["--n" as string]: TABS.length }}>
        <Link className="tabs-brand" to="/home" aria-label="WayFinder home"><img src="/wf/logo-lockup.png" alt="" width={881} height={399} /></Link>
        <span className="tab-ind" style={{ ["--i" as string]: idx, ["--from" as string]: from }} aria-hidden="true"><span /></span>
        {TABS.map(([ic, l, h]) => (
          <Link key={l} className={`tab${l === on ? " on" : ""}`} to={h(!!sched(S))} aria-current={l === on ? "page" : undefined}>
            <span className="tab-ic"><I n={ic} /></span><span>{l}</span>
          </Link>
        ))}
      </nav>
      {on === "Map" ? null : <AskFab />}
    </>
  );
}
export function AskFab() {
  const nav = useNavigate(), loc = useLocation();
  return <button className="ask-fab" type="button" aria-label="Ask WayFinder" onClick={() => nav("/ask", { state: { back: loc.pathname + loc.search } })}><I n="ask" /></button>;
}

/** Back goes to the previous screen when there is one, otherwise to `fallback`. */
export function useBack(fallback: string) {
  const nav = useNavigate(), loc = useLocation();
  return () => { if (loc.key !== "default" && window.history.length > 1) nav(-1); else nav(fallback); };
}
export function Bar({ title, back, backLabel = "Back", right, onBack }: { title: string; back: string; backLabel?: string; right?: ReactNode; onBack?: () => void }) {
  const goBack = useBack(back);
  return (
    <header className="bar">
      <button className="back" type="button" onClick={onBack || goBack}><I n="back" /><span>{backLabel}</span></button>
      <span className="title">{title}</span>{right}
    </header>
  );
}
/** Official WVSU wayfinder logo. Clear space on every side is at least the height of its "wayfinder" line. */
export function LockupBar({ right, onGold = false }: { right?: ReactNode; onGold?: boolean }) {
  return (
    <header className="bar brandbar">
      <span className={`logo-wrap${onGold ? " on-gold" : ""}`}><img className="logo-lockup" src="/wf/logo-lockup.png" alt="WVSU WayFinder" width={881} height={399} /></span>{right}
    </header>
  );
}
/** One-shot toast stored in state; disappears after a few seconds. */
export function Toast() {
  const { S, set } = useWF();
  useEffect(() => { if (!S.toast) return; const t = setTimeout(() => set((d) => { d.toast = null; }), 4200); return () => clearTimeout(t); }, [S.toast, set]);
  return S.toast ? <div className="toast" role="status" dangerouslySetInnerHTML={{ __html: S.toast }} /> : null;
}
export const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
/** Toast HTML with a check icon, as the prototype shows it. */
export const toastHtml = (inner: string) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg><span>${inner}</span>`;
