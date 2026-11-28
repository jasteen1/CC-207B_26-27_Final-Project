/* 05–16, 06A–06D, 33: Home, scan → review → save, schedule, class, notifications, lock screen, class reminder. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  CAMPUS, DAY3, I, Needle, W, addNote, buildingOf, copySchedule, day, draftOf, enc, fmtMin, fmtShort, initials, me, mins, movedNote, pfName, range,
  reminderNote, sched, unread, upcoming, useWF, type Meeting, type State, type Subject,
} from "../core";
import { Bar, LockupBar, Tabs, Toast, toastHtml } from "../ui/chrome";

/* ---------- shared: the CICT → Quezon Hall route in miniature ---------- */
export function MiniRoute() {
  const r = W.routes["cict-building>quezon-hall"], xs = r.pts.map((q: number[]) => q[0]), ys = r.pts.map((q: number[]) => q[1]);
  const pad = 10, x0 = Math.min(...xs) - pad - 8, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad + 14, h = Math.max(...ys) - y0 + pad;
  const near = CAMPUS.shapes.filter((s: any) => !s.line && s.cx > x0 - 40 && s.cx < x0 + w + 40 && s.cy > y0 - 40 && s.cy < y0 + h + 40);
  const d = "M" + r.pts.map((q: number[]) => q.join(" ")).join(" L"), e = r.pts[r.pts.length - 1], s0 = r.pts[0];
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect x={x0 - 50} y={y0 - 50} width={w + 100} height={h + 100} fill="#F2EADB" />
      {near.map((s: any, i: number) => <path key={i} d={s.d} fill={s.name === "Quezon Hall" ? "#F3B53A" : s.name === "CICT Building" ? "#9FC3E8" : "#E1D7C3"} stroke={s.name === "Quezon Hall" ? "#B87900" : "#CDBFA4"} strokeWidth=".5" />)}
      <path d={d} fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path className="mini-line" d={d} fill="none" stroke="#123A9C" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
      <circle cx={s0[0]} cy={s0[1]} r="3.6" fill="#2E6FB8" stroke="#fff" strokeWidth="1.4" /><circle cx={e[0]} cy={e[1]} r="4.2" fill="#F3B53A" stroke="#132D6B" strokeWidth="1.2" />
    </svg>
  );
}

/* ---------- class reminder: 15 minutes before class a notification slides in from the top ---------- */
/** Sends the sample reminder (today's CIT 251 moved to QH 1, you're still at CICT). Returns false when there's no schedule. */
export function useSendReminder() {
  const { set } = useWF();
  return (force: boolean) => set((d) => {
    if (!d.signed || !d.saved) return;
    if (!force && d.notified) return;
    d.notified = true; d.now = W.reminderDemo.at;
    const n = reminderNote(d); if (n) addNote(d, n);
    d.toast = null; (d as State & { push?: number }).push = Date.now();
  });
}
export function PushHost() {
  const { S, set } = useWF(), nav = useNavigate();
  const stamp = (S as State & { push?: number }).push;
  const [state, setState] = useState<"in" | "out" | "">("");
  useEffect(() => { if (!stamp) return; setState("in"); const t = setTimeout(() => setState("out"), 12000); return () => clearTimeout(t); }, [stamp]);
  const x = S.saved && S.saved.find((c) => c.code === W.reminderDemo.code);
  if (!stamp || !x) return null;
  const r = W.reminderDemo, m = x.m[r.meeting], b = W.places[buildingOf(m[3]) || ""];
  const hide = () => { setState("out"); set((d) => { delete (d as State & { push?: number }).push; }); };
  let y0: number | null = null;
  return (
    <div id="push" className={`push-wrap ${state}`} onPointerDown={(e) => { y0 = e.clientY; }} onPointerUp={(e) => { if (y0 != null && e.clientY - y0 < -24) hide(); y0 = null; }}>
      <div className="push" role="group" aria-label="Class reminder">
        <span className="push-ic"><img src="/wf/logo.png" alt="" /></span>
        <span className="push-body"><span className="push-top"><b>WayFinder</b><span>now</span></span>
          <span className="push-title">{x.code} in 15 min</span>
          <span className="push-text">Moved to <b>{m[3]}</b>, {b ? b.name : ""}.</span>
          <span className="push-actions">
            <button className="push-btn primary" type="button" onClick={() => { hide(); nav(`/map/route?from=${r.from}&to=${buildingOf(m[3])}&room=${enc(r.room)}`); }}><I n="map" /> Show on map</button>
            <button className="push-btn" type="button" onClick={() => { hide(); nav(`/class/${enc(x.code)}/${r.meeting}`); }}>View class</button>
          </span></span>
        <button className="push-x" type="button" aria-label="Dismiss" onClick={hide}><I n="x" /></button>
      </div>
    </div>
  );
}

/* ---------- Home: one glance tells you what's next, where, and how to get there ---------- */
export function Home() {
  const { S, set } = useWF(), [p] = useSearchParams(), send = useSendReminder(), loc = useLocation();
  useEffect(() => {
    if (p.get("returning")) set((d) => { d.signed = true; d.saved = d.saved || copySchedule(); });
    if (p.get("first")) set((d) => { d.firstTime = true; d.saved = null; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (S.notified || !S.saved || !S.signed) return; const t = setTimeout(() => { if (window.location.pathname === "/home") send(false); }, 3500); return () => clearTimeout(t); }, [S.notified, S.saved, S.signed, loc.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const suite = useRef<HTMLDivElement>(null); const [card, setCard] = useState(0);
  useEffect(() => { const su = suite.current; if (!su) return; let t = 0; const on = () => { clearTimeout(t); t = window.setTimeout(() => { const cards = [...su.children] as HTMLElement[]; setCard(cards.reduce((best, c, k) => Math.abs(c.offsetLeft - su.scrollLeft - 12) < Math.abs(cards[best].offsetLeft - su.scrollLeft - 12) ? k : best, 0)); }, 60); }; su.addEventListener("scroll", on); return () => su.removeEventListener("scroll", on); }, []);
  const s = sched(S), list = upcoming(S), now = S.now, next = list.find((it) => mins(it.m[1]) > now), current = list.find((it) => mins(it.m[1]) <= now && mins(it.m[2]) > now);
  const startsIn = next ? mins(next.m[1]) - now : 0, moved = next && movedNote(S, next.x.code, next.mi);
  const hour = Math.floor(now / 60), greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  let free = 0, freeAt: number[] | null = null; for (let i = 1; i < list.length; i++) { const g = mins(list[i].m[1]) - mins(list[i - 1].m[2]); if (g > 0) { free += g; if (!freeAt) freeAt = [mins(list[i - 1].m[2]), mins(list[i].m[1])]; } }
  const week = s ? s.reduce((a, x) => a + x.m.length, 0) : 0;
  const dialFrac = next ? Math.max(0.06, Math.min(1, 1 - startsIn / 60)) : 0, C = 2 * Math.PI * 42;
  const b = next ? W.places[buildingOf(next.m[3]) || ""] : null, n = unread(S), who = me(S);
  return (
    <section className="view has-tabs home2"><div className="scroll"><div className="home-wrap">
      <div className="hx">
        <div className="hx-top rise" style={{ ["--d" as string]: 0 }}><img className="hx-logo" src="/wf/logo-lockup.png" alt="WVSU WayFinder" width={881} height={399} />
          <span className="hx-actions"><Link className="bell" to="/notifications" aria-label={`Notifications${n ? `, ${n} new` : ""}`}><I n="bell" />{n ? <span className="bell-n">{n}</span> : null}</Link>
            <Link className="avatar" to="/profile?step=3&edit=1" aria-label={`Your profile, ${pfName(who)}`}>{initials(who)}</Link></span></div>
        <p className="eyebrow rise" style={{ ["--d" as string]: 1 }}>{day(W.today.day).toUpperCase()} · {fmtMin(now)}</p>
        <h1 className="hx-title rise" style={{ ["--d" as string]: 1 }}>{greet}, {who.first}.</h1>
        <p className="hx-sub rise" style={{ ["--d" as string]: 2 }}>{current && next ? <>{current.x.code} is on now in {current.m[3]}. Next: <b>{next.x.code} in {startsIn} minutes</b>.</> : next ? <>{list.length} classes today. The first starts in <b>{startsIn} minutes</b>.</> : "Let’s get your classes in one place."}</p>
        <Link className="hx-search rise" style={{ ["--d" as string]: 2 }} to="/map?focus=search"><I n="search" /><span>Search buildings, rooms, offices</span></Link>
        {next ? (
          <article className="nextcard rise" style={{ ["--d" as string]: 3 }} aria-label="Next class">
            <div className="nc-head"><span className="tag gold"><Needle size={14} /> NEXT CLASS</span><Link className="nc-link" to="/schedule">My schedule <I n="chev" /></Link></div>
            <div className="nc-main">
              <div className="dial" role="img" aria-label={`Starts in ${startsIn} minutes`}>
                <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" fill="none" stroke="#E6EEF9" strokeWidth="9" />
                  <circle className="dial-arc" cx="50" cy="50" r="42" fill="none" stroke="url(#dialg)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - dialFrac)).toFixed(1)} style={{ ["--c" as string]: C.toFixed(1) }} transform="rotate(-90 50 50)" />
                  <defs><linearGradient id="dialg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3F8FD2" /><stop offset="1" stopColor="#1B3C8A" /></linearGradient></defs></svg>
                <span className="dial-num">{startsIn}</span><span className="dial-unit">min to start</span></div>
              <div className="nc-info"><p className="nc-code">{next.x.code}</p><p className="nc-title">{next.x.title}</p><p className="nc-time">{day(next.m[0])} · {range(next.m[1], next.m[2])}</p></div>
            </div>
            {moved && <p className="moved"><I n="alert" /><span>Moved today from <b>{moved.from}</b> to <b>{moved.to}</b></span></p>}
            <div className={`nc-room${moved ? " is-moved" : ""}`}><div><p className="label">ROOM</p><p className="room">{next.m[3]}</p></div>
              <div className="nc-bldg"><p className="label">BUILDING</p><p className="h3">{b ? b.name : "Not recorded"}</p><p className="small">{b && b.rooms[next.m[3]] ? `Floor ${b.rooms[next.m[3]].floor}` : "Floor not confirmed"}</p></div></div>
            <Link className="btn primary wide" to={`/class/${enc(next.x.code)}/${next.mi}`}><I n="pin" /> Find classroom</Link>
            {moved && <Link className="btn outline wide" to={`/map/route?from=${W.reminderDemo.from}&to=${buildingOf(next.m[3])}&room=${enc(next.m[3])}`}><I n="route" /> Show the way from CICT</Link>}
          </article>
        ) : (
          <article className="nextcard rise" style={{ ["--d" as string]: 3 }}>
            <span className="tag"><I n="cal" /> GET STARTED</span>
            <h2 className="h2" style={{ marginTop: 12 }}>Add your class schedule</h2><p className="body" style={{ marginTop: 6 }}>Scan your timetable once. WayFinder shows your next class and where it meets.</p>
            <Link className="btn primary wide" to="/scan" style={{ marginTop: 16 }}><I n="camera" /> Scan timetable</Link>
            <Link className="link" to="/manual" style={{ marginTop: 4, alignSelf: "center" }}>Add a class by hand</Link>
          </article>
        )}
      </div>
      {next && <>
        <div className="statrow rise" style={{ ["--d" as string]: 4 }}>
          <div className="stat"><p className="stat-num">{list.length}</p><p className="stat-lbl">classes today</p></div>
          <div className="stat"><p className="stat-num">{free >= 60 ? <>{Math.round(free / 60)}<small>h</small></> : <>{free}<small>m</small></>}</p><p className="stat-lbl">{freeAt ? `free ${fmtMin(freeAt[0]).replace(/ (AM|PM)/, "")}–${fmtMin(freeAt[1])}` : "no gaps"}</p></div>
          <div className="stat"><p className="stat-num">{week}</p><p className="stat-lbl">meetings this week</p></div></div>
        <section className="hsec"><div className="hsec-head"><h2 className="h2">Today</h2><Link className="nc-link" to={`/schedule?view=week&day=${W.today.day}`}>Week view <I n="chev" /></Link></div>
          <ol className="tl2-list">{list.filter((it) => mins(it.m[2]) > now).map((it) => (
            <li key={`${it.si}-${it.mi}`}><Link className={`tl2${it === next ? " is-next" : ""}`} to={`/class/${enc(it.x.code)}/${it.mi}`}>
              <span className="tl2-time">{it.m[1]}</span><span className="tl2-dot" aria-hidden="true" />
              <span className="tl2-body"><span className="tl2-code">{it.x.code}{it === next && <> <span className="tag gold sm">Next</span></>}</span><span className="small clamp1">{it.x.title}</span></span>
              <span className="room-sm">{it.m[3]}</span></Link></li>))}</ol></section>
      </>}
      <section className="hsec"><div className="hsec-head"><h2 className="h2">Get around campus</h2></div>
        <div className="suite" role="list" id="suite" ref={suite}>
          <Link className="suite-card" role="listitem" to="/map/route?from=cict-building&to=quezon-hall"><div className="sc-prev map"><MiniRoute /></div>
            <div className="sc-body"><p className="sc-title">Walk to Quezon Hall <I n="chev" /></p><p className="small">Preview the path from CICT, turn by turn.</p><span className="tag">WALK</span></div></Link>
          <Link className="suite-card" role="listitem" to="/directory"><div className="sc-prev dir"><div className="sc-row"><b>Registrar</b><span>Admin · F1</span></div><div className="sc-row"><b>Admission Office</b><span>Admin · F1</span></div><div className="sc-row"><b>CAS-SC Office</b><span>Student’s Center · F2</span></div></div>
            <div className="sc-body"><p className="sc-title">Directory <I n="chev" /></p><p className="small">Find an office and see which building and floor.</p><span className="tag">FIND</span></div></Link>
          <Link className="suite-card" role="listitem" to="/ask"><div className="sc-prev ask"><span className="q">Where is my Wednesday CIT 213 class?</span><span className="a"><Needle size={12} /> ICT 306 · 7:00 AM</span></div>
            <div className="sc-body"><p className="sc-title">Ask WayFinder <I n="chev" /></p><p className="small">Ask where and when your classes meet.</p><span className="tag">ASK</span></div></Link>
        </div>
        <div className="suite-dots" role="tablist" aria-label="Get around campus cards">{[0, 1, 2].map((i) => <button key={i} role="tab" aria-selected={i === card} aria-label={`Card ${i + 1} of 3`} onClick={() => { const su = suite.current, c = su && su.children[i] as HTMLElement; if (su && c) su.scrollTo({ left: c.offsetLeft - 12, behavior: "smooth" }); }} />)}</div></section>
      {s && <div className="banner"><span className="banner-ico"><I n="cal" /></span><div className="grow"><p className="eyebrow">SY 2026–2027 · 1ST SEMESTER</p><p className="h3">{s.length} subjects saved</p><p className="small">Read from your timetable photo.</p></div><Link className="btn sm outline" to="/scan">Rescan</Link></div>}
    </div></div><Tabs on="Home" /><Toast /></section>
  );
}

/* ---------- 07 scan: choose a photo ---------- */
export function Scan() {
  const { S } = useWF();
  return (
    <section className="view"><Bar title="Scan timetable" back="/home" backLabel="Home" />
      <div className="scroll" style={{ top: 60 }}><div className="pad stack gap-16" style={{ paddingBottom: 28 }}>
        <h1 className="h1">Scan your timetable</h1>
        <p className="body">Use a photo or screenshot of your WVSU class schedule. You’ll check every class before anything is saved.</p>
        {sched(S) && <div className="note info"><I n="info" /><span>Your saved classes stay as they are unless you save a new scan.</span></div>}
        <div className="scan-tips card"><p className="label">WORKS BEST WITH</p>
          <ul><li><I n="check" /> The whole timetable in the frame</li><li><I n="check" /> The subject table and the weekly grid</li><li><I n="check" /> A screenshot from the student portal</li></ul></div>
        <div className="stack gap-12">
          <Link className="btn primary wide" to="/scan/reading"><I n="photo" /> Choose timetable photo</Link>
          <Link className="btn outline wide" to="/scan/reading?src=camera"><I n="camera" /> Take a photo</Link>
        </div>
        <Link className="link" to="/manual" style={{ alignSelf: "center" }}>Add classes by hand instead</Link>
      </div></div><Toast /></section>
  );
}

/* ---------- 08 reading: a scan line reveals each class row ---------- */
export function Reading() {
  const { reduced } = useWF(), [p] = useSearchParams();
  const fixed = p.has("t") ? +p.get("t")! : null, H = 245;
  const [pct, setPct] = useState(fixed ?? (reduced ? 1 : 0));
  useEffect(() => {
    if (fixed !== null || reduced) return;
    let raf = 0; const t0 = performance.now(), dur = 2600;
    const step = (now: number) => { const x = Math.min(1, (now - t0) / dur); setPct(x < 1 ? x * x * (3 - 2 * x) : 1); if (x < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [fixed, reduced]);
  const y = pct * H, found = (W.schedule as Subject[]).filter((s) => y >= (s.row || 0)), done = pct >= 1;
  return (
    <section className="view"><Bar title="Reading timetable" back="/scan" backLabel="Cancel" />
      <div className="scroll" style={{ top: 60 }}><div className="pad stack gap-16" style={{ paddingBottom: 28 }}>
        <div className="photo" id="scanphoto" style={{ height: H }}><img src="/wf/schedule.png" alt="Your WVSU class schedule" />
          <div className="scanline" style={{ top: `${y.toFixed(1)}px`, opacity: done ? 0 : 1 }} />
          {found.map((r) => <span key={r.code} className="rowmark found" style={{ top: (r.row || 0) - 6 }} />)}</div>
        <div className="stack gap-8"><div className="row"><p className="h3" style={{ flex: 1 }}>{done ? "All 7 subjects read · 15 meetings" : "Reading your timetable…"}</p><span className="pill" role="status">{found.length} of 7 subjects read</span></div>
          <div className="progress" aria-hidden="true"><span style={{ width: `${(found.length / 7) * 100}%` }} /></div></div>
        <div className="list">{found.map((r) => <div key={r.code} className="item found" style={{ minHeight: 52 }}><span className="grow"><span className="h3" style={{ fontSize: 15 }}>{r.code}</span><span className="small">{r.title}</span></span><span className="pill">{r.m.length} meetings</span></div>)}</div>
        <Link className="btn primary wide" to="/scan/review" style={{ visibility: done ? "visible" : "hidden" }}>Review 7 subjects</Link>
      </div></div></section>
  );
}

/* ---------- 09–11 review: seven expandable subjects covering all 15 meetings ---------- */
export function Review() {
  const { S, set } = useWF(), [p, setP] = useSearchParams(), nav = useNavigate();
  const editKey = p.get("edit");
  useEffect(() => { set((d) => { draftOf(d); if (editKey && !d.openSubj.includes(+editKey.split("-")[0])) d.openSubj.push(+editKey.split("-")[0]); if (p.get("all") === "1") d.openSubj = (d.draft || []).map((_, i) => i); }); }, [editKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const D = S.draft || copySchedule(), total = D.reduce((a, x) => a + x.m.length, 0), allOpen = S.openSubj.length === D.length;
  const toggle = (si: number) => set((d) => { const i = d.openSubj.indexOf(si); if (i >= 0) d.openSubj.splice(i, 1); else d.openSubj.push(si); });
  const saveEdit = (e: FormEvent<HTMLFormElement>, si: number, mi: number) => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    set((d) => { const Dd = draftOf(d), prev = Dd[si].m[mi].slice() as Meeting;
      Dd[si].m[mi] = [prev[0], (String(data.get("start") || "") || prev[1]).trim(), (String(data.get("end") || "") || prev[2]).trim(), (String(data.get("room") || "") || prev[3]).trim()];
      d.lastEdit = { key: `${si}-${mi}`, prev, label: `${Dd[si].code} ${day(prev[0])}` }; });
    setP({}, { replace: true });
  };
  return (
    <section className="view review"><Bar title="Check your classes" back="/scan" backLabel="Retake" />
      <div className="scroll review-scroll" style={{ top: 60 }}><div className="pad stack gap-12" style={{ paddingBottom: 20 }}>
        <div className="row" style={{ alignItems: "flex-end" }}><h1 className="h1" style={{ flex: 1 }}>7 subjects, {total} meetings</h1></div>
        <div className="row" style={{ justifyContent: "space-between" }}><p className="small" style={{ flex: 1 }}>Open a subject to check its days, times and rooms.</p>
          <button className="link" type="button" style={{ minHeight: 40, padding: "0 4px", flex: "none" }} onClick={() => set((d) => { d.openSubj = allOpen ? [] : D.map((_, i) => i); })}>{allOpen ? "Collapse all" : `Show all ${total}`}</button></div>
        {D.map((x, si) => {
          const open = S.openSubj.includes(si), rooms = [...new Set(x.m.map((m) => m[3]))], editedHere = S.lastEdit && +S.lastEdit.key.split("-")[0] === si;
          return (
            <article key={x.code} className={`card subj${open ? " open" : ""}${editedHere ? " has-edit" : ""}`}>
              <button className="subj-head" type="button" aria-expanded={open} aria-controls={`subj-${si}`} onClick={() => toggle(si)}>
                <span className="grow"><span className="row" style={{ gap: 8 }}><span className="h3">{x.code}</span>{editedHere && <span className="pill gold" style={{ height: 22, fontSize: 12 }}>Edited</span>}</span><span className="small clamp1">{x.title}</span>
                  <span className="subj-sum">{x.m.map((m) => DAY3(m[0])).join(" · ")} <span aria-hidden="true">|</span> {rooms.join(", ")}</span></span>
                <span className="count">{x.m.length}<small>meeting{x.m.length > 1 ? "s" : ""}</small></span><I n="caret" cls="ico caret" /></button>
              {open && <div className="subj-body stack gap-8" id={`subj-${si}`}>{x.m.map((m, mi) => {
                const key = `${si}-${mi}`, edited = S.lastEdit && S.lastEdit.key === key;
                if (editKey === key) return (
                  <form key={key} className="card stack gap-12" style={{ padding: 14, background: "var(--cream)", borderColor: "var(--navy-2)" }} onSubmit={(e) => saveEdit(e, si, mi)}>
                    <p className="h3">Edit {x.code} · {day(m[0])}</p>
                    <label className="stack gap-8 label">Room<span className="field"><input name="room" defaultValue={m[3]} autoComplete="off" autoFocus /></span></label>
                    <div className="row" style={{ gap: 10 }}><label className="stack gap-8 label" style={{ flex: 1 }}>Starts<span className="field"><input name="start" defaultValue={m[1]} /></span></label><label className="stack gap-8 label" style={{ flex: 1 }}>Ends<span className="field"><input name="end" defaultValue={m[2]} /></span></label></div>
                    <div className="row" style={{ gap: 10 }}><Link className="btn outline sm" style={{ flex: 1 }} to="/scan/review" replace>Cancel</Link><button className="btn primary sm" style={{ flex: 1 }} type="submit">Save meeting</button></div></form>);
                return (
                  <div key={key} className="stack gap-8">
                    <div className={`meeting${edited ? " edited" : ""}`}><span className="stack" style={{ gap: 2 }}><span className="h3" style={{ fontSize: 15 }}>{day(m[0])}</span><span className="small">{range(m[1], m[2])}</span></span><span className="room-sm">{m[3]}</span>
                      <Link className="icon-btn" to={`/scan/review?edit=${key}`} replace aria-label={`Edit ${x.code} ${day(m[0])}`}><I n="edit" /></Link></div>
                    {edited && <div className="note ok undo-note" role="status"><I n="check" /><span style={{ flex: 1 }}>Updated {S.lastEdit!.label}.</span><button className="link" style={{ minHeight: 40, padding: "0 4px" }} onClick={() => set((d) => { const [a, b] = d.lastEdit!.key.split("-").map(Number); draftOf(d)[a].m[b] = d.lastEdit!.prev; d.lastEdit = null; })}><I n="undo" /> Undo</button></div>}
                  </div>);
              })}</div>}
            </article>);
        })}
      </div></div>
      <div className="review-actions"><button className="btn primary wide" onClick={() => { set((d) => { d.saved = d.draft || copySchedule(); d.draft = null; d.lastEdit = null; d.firstTime = false; }); nav("/schedule?view=week&day=1&saved=1"); }}><I n="check" /> Save schedule</button>
        <div className="row" style={{ gap: 8, justifyContent: "center" }}><Link className="link" to="/scan">Retake photo</Link><span aria-hidden="true" style={{ color: "var(--line-2)" }}>·</span>
          <button className="link" onClick={() => { const had = !!S.saved; set((d) => { d.draft = null; d.lastEdit = null; d.toast = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg><span>Scan cancelled. Your schedule didn’t change.</span>`; }); nav(had ? "/schedule" : "/home"); }}>Cancel</button></div></div>
    </section>
  );
}

/* ---------- 33 add a class by hand ---------- */
export function Manual() {
  const { set } = useWF(), nav = useNavigate(), [d0, setD] = useState(3);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget), subj = String(f.get("subject") || "").trim(), room = String(f.get("room") || "").trim();
    set((d) => {
      d.saved = d.saved || copySchedule();
      if (subj && room) { const [code, ...rest] = subj.split(/\s+(?=[A-Z][a-z])/); d.saved.push({ code: code || subj, title: rest.join(" ") || subj, m: [[d0, String(f.get("start") || "7:00 AM"), String(f.get("end") || "8:00 AM"), room]] }); }
      d.signed = true; d.toast = toastHtml("Class saved");
    });
    nav("/schedule");
  };
  return (
    <section className="view"><Bar title="Add a class" back="/home" />
      <div className="scroll" style={{ top: 60 }}><form className="pad stack gap-16" style={{ paddingBottom: 28 }} onSubmit={submit}>
        <h1 className="h1">Add a class</h1>
        <label className="stack gap-8 label">Subject<span className="field"><input name="subject" placeholder="e.g. CIT 213 Human Computer Interaction 2" /></span></label>
        <div className="stack gap-8 label">Day<span className="seg" role="group">{[1, 2, 3, 4, 5, 6].map((k) => <button key={k} type="button" aria-pressed={k === d0} onClick={() => setD(k)}>{day(k).slice(0, 3)}</button>)}</span></div>
        <div className="row" style={{ gap: 10 }}><label className="stack gap-8 label" style={{ flex: 1 }}>Starts<span className="field"><input name="start" placeholder="7:00 AM" /></span></label><label className="stack gap-8 label" style={{ flex: 1 }}>Ends<span className="field"><input name="end" placeholder="10:00 AM" /></span></label></div>
        <label className="stack gap-8 label">Room<span className="field"><input name="room" placeholder="e.g. ICT 306" /></span></label>
        <button className="btn primary wide" type="submit">Save class</button><Link className="link" to="/home" style={{ alignSelf: "center" }}>Cancel</Link>
      </form></div></section>
  );
}

/* ---------- 12–14 schedule: week at a glance, then the day as a rail ---------- */
type It = { x: Subject; si: number; mi: number; m: Meeting };
function DayRail({ items, isToday, S }: { items: It[]; isToday: boolean; S: State }) {
  const now = S.now, first = mins(items[0].m[1]), last = Math.max(...items.map((it) => mins(it.m[2])));
  const s0 = Math.floor(Math.min(first, isToday ? now : first) / 60) * 60, s1 = Math.ceil(last / 60) * 60, K = 1.05;
  const y = (m: number) => +((m - s0) * K).toFixed(1);
  const hours: number[] = []; for (let h = s0; h <= s1; h += 60) hours.push(h);
  const next = isToday ? items.find((it) => mins(it.m[1]) > now) : null;
  const gaps: number[][] = []; for (let i = 1; i < items.length; i++) { const a = mins(items[i - 1].m[2]), b = mins(items[i].m[1]); if (b - a >= 30) gaps.push([a, b]); }
  return (
    <div className="rail" style={{ height: Math.round((s1 - s0) * K + 8) }}>
      {hours.map((h) => <span key={h} className="rail-h" style={{ top: y(h) }}><span>{fmtShort(h)} {h < 720 ? "AM" : "PM"}</span></span>)}
      {gaps.map(([a, b]) => <div key={a} className="rail-free" style={{ top: y(a), height: +((b - a) * K - 6).toFixed(1) }}><span>Free for {b - a >= 60 ? `${Math.floor((b - a) / 60)} h${(b - a) % 60 ? ` ${(b - a) % 60} min` : ""}` : `${b - a} min`}</span></div>)}
      {items.map((it) => { const a = mins(it.m[1]), b = mins(it.m[2]), isNext = it === next, past = isToday && b <= now, onNow = isToday && a <= now && b > now, mv = movedNote(S, it.x.code, it.mi);
        return (
          <Link key={`${it.si}-${it.mi}`} className={`rail-b${isNext ? " next" : ""}${onNow ? " on-now" : ""}${past ? " past" : ""}${b - a < 100 ? " short" : ""}`} style={{ top: y(a), height: +((b - a) * K - 6).toFixed(1) }} to={`/class/${enc(it.x.code)}/${it.mi}`}>
            <span className="rb-main"><span className="rb-code">{it.x.code}{isNext ? " · next" : onNow ? " · now" : ""}</span>{mv && <span className="rb-moved">Moved from {mv.from} today</span>}<span className="rb-title">{it.x.title}</span><span className="rb-time">{range(it.m[1], it.m[2])}</span></span>
            <span className="rb-room">{it.m[3]}</span></Link>); })}
      {isToday && now >= s0 && now <= s1 && <div className="rail-now" style={{ top: y(now) }}><span>{fmtMin(now)}</span></div>}
    </div>
  );
}
export function Schedule() {
  const { S, set } = useWF(), [p] = useSearchParams(), nav = useNavigate();
  useEffect(() => { if (!S.saved) set((d) => { d.saved = copySchedule(); d.signed = true; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const view = (p.get("view") as "today" | "week") || S.view, d = +(p.get("day") || S.weekDay);
  useEffect(() => { if (view !== S.view || d !== S.weekDay) set((x) => { x.view = view; x.weekDay = d; }); }, [view, d]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = S.saved || copySchedule();
  const showDay = view === "today" ? W.today.day : d, isToday = showDay === W.today.day && view === "today";
  const items: It[] = []; s.forEach((x, si) => x.m.forEach((m, mi) => { if (m[0] === showDay) items.push({ x, si, mi, m }); }));
  items.sort((a, b) => mins(a.m[1]) - mins(b.m[1]));
  const total = s.reduce((a, x) => a + x.m.length, 0);
  const span = items.length ? `${items.length} class${items.length > 1 ? "es" : ""}, ${items[0].m[1]} to ${items[items.length - 1].m[2]}` : "No classes";
  const S0 = 7 * 60, S1 = 18 * 60;
  return (
    <section className="view has-tabs sched2"><LockupBar />
      <div className="scroll" style={{ top: 60 }}><div className="pad stack gap-16" style={{ paddingBottom: 28 }}>
        {p.get("saved") && <div className="note ok" role="status"><I n="check" /><span><b>Schedule saved.</b> {s.length} subjects · {total} weekly meetings.</span></div>}
        <div className="sc-head"><h1 className="h1">My schedule</h1><div className="seg seg-sm" role="tablist"><button role="tab" aria-selected={view === "today"} onClick={() => nav("/schedule?view=today", { replace: true })}>Today</button><button role="tab" aria-selected={view === "week"} onClick={() => nav(`/schedule?view=week&day=${d}`, { replace: true })}>Week</button></div></div>
        {view === "week" && <div className="wk" role="tablist" aria-label="Week">{[1, 2, 3, 4, 5, 6].map((k) => {
          const ms: Meeting[] = []; s.forEach((x) => x.m.forEach((m) => { if (m[0] === k) ms.push(m); }));
          return (
            <button key={k} className={`wk-day${k === d ? " on" : ""}${k === W.today.day ? " today" : ""}`} role="tab" aria-selected={k === d} aria-label={`${day(k)}, ${ms.length} classes`} onClick={() => nav(`/schedule?view=week&day=${k}`, { replace: true })}>
              <span className="wk-name">{DAY3(k)}</span><span className="wk-track">{ms.map((m, i) => <i key={i} style={{ top: `${((mins(m[1]) - S0) / (S1 - S0) * 100).toFixed(1)}%`, height: `${((mins(m[2]) - mins(m[1])) / (S1 - S0) * 100).toFixed(1)}%` }} />)}</span>
              <span className="wk-n">{ms.length || "–"}</span></button>);
        })}</div>}
        <div className="sc-day"><h2 className="h2">{view === "today" ? `Today · ${day(W.today.day)}` : day(d)}</h2><p className="small">{span}</p></div>
        {items.length ? <DayRail items={items} isToday={isToday} S={S} />
          : <div className="card dashed" style={{ textAlign: "center" }}><p className="h3">No classes on {day(showDay)}</p><p className="small" style={{ marginTop: 4 }}>Pick another day above to see its classes.</p></div>}
        <Link className="link" to="/scan" style={{ alignSelf: "center" }}>Scan a new timetable</Link>
      </div></div><Tabs on="Schedule" /><Toast /></section>
  );
}

/* ---------- 15–16 one subject, every meeting; tap a meeting to see its room ---------- */
export function Klass() {
  const { S } = useWF(), { code = "CIT 213", mi: miS = "0" } = useParams(), [p] = useSearchParams(), nav = useNavigate(), loc = useLocation();
  const mi = +miS, s = (S.saved || W.schedule).find((x: Subject) => x.code === code) || W.schedule[1];
  const m = s.m[mi] || s.m[0], bid = buildingOf(m[3]), b = bid ? W.places[bid] : null, flash = p.get("flash") === "1";
  const from = (loc.state as { from?: string } | null)?.from;
  return (
    <section className="view has-tabs"><Bar title={s.code} back="/schedule" backLabel={from === "answer" ? "Answer" : "Schedule"} />
      <div className="scroll" style={{ top: 60 }}><div className="pad stack gap-16" style={{ paddingBottom: 24 }}>
        <div className="stack gap-8"><h1 className="h1">{s.title}</h1><p className="small">{s.code} · {s.m.length} meetings a week</p></div>
        <div className="seg" role="group" aria-label="Meeting">{s.m.map((x: Meeting, i: number) => <button key={i} aria-pressed={i === mi} onClick={() => nav(`/class/${enc(s.code)}/${i}?flash=1`, { replace: true, state: loc.state })}>{day(x[0])}</button>)}</div>
        <div className="tiles2" key={`${mi}-${flash}`}><div className={`vtile${flash ? " flash" : ""}`}><p className="label">TIME</p><p className="h2" style={{ marginTop: 6 }}>{range(m[1], m[2])}</p></div>
          <div className={`vtile${flash ? " flash" : ""}`}><p className="label">ROOM</p><p className="room" style={{ marginTop: 4 }}>{m[3]}</p></div></div>
        {movedNote(S, s.code, mi) && <p className="moved"><I n="alert" /><span>Today only: moved from <b>{S.moved!.from}</b> to <b>{S.moved!.to}</b>.</span></p>}
        <p className="body">{b ? b.name : "Building not recorded"} · {day(m[0])}s</p>
        <Link className="btn primary wide" to={bid ? `/map/place/${bid}?room=${enc(m[3])}&from=class` : `/map?q=${enc(m[3])}`}><I n="pin" /> Find classroom</Link>
        <Link className="btn outline wide" to="/ask">Ask about this class</Link>
      </div></div><Tabs on="Schedule" /></section>
  );
}

/* ---------- 06D notifications ---------- */
export function Notifications() {
  const { S, set } = useWF();
  useEffect(() => {
    set((d) => {
      if (!d.saved) d.saved = copySchedule();
      if (!d.notes.length) { const n = reminderNote(d); if (n) { addNote(d, { id: "saved", kind: "info", at: "6:30 AM", title: "Schedule saved", body: "7 subjects", read: true }); addNote(d, n); d.now = W.reminderDemo.at; } }
    });
    return () => set((d) => { d.notes = d.notes.map((n) => ({ ...n, read: true })); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const list = S.notes;
  return (
    <section className="view has-tabs notes2"><Bar title="Notifications" back="/home" backLabel="Home" />
      <div className="scroll" style={{ top: 60 }}><div className="pad stack gap-16" style={{ paddingBottom: 28 }}>
        <h1 className="h1">Notifications</h1>
        {list.length ? <><p className="label">Today</p>{list.map((n) => n.kind === "class" ? (
          <article key={n.id} className={`note-card${n.read ? "" : " unread"}`}>
            <div className="nt-head"><span className="push-ic"><img src="/wf/logo.png" alt="" /></span><span className="grow"><span className="nt-app">Class reminder</span><span className="nt-time">{n.at}</span></span>{!n.read && <span className="nt-dot" aria-label="New" />}</div>
            <h2 className="nt-title">{n.title}</h2><p className="body">{n.body}</p>
            <div className="nt-map"><MiniRoute /><span className="nt-map-l">CICT → {n.room}</span></div>
            <div className="two-btn"><Link className="btn primary" to={n.map!}><I n="map" /> Show on map</Link><Link className="btn outline" to={n.cls!}>View class</Link></div></article>
        ) : (
          <article key={n.id} className="note-card small-note"><div className="nt-head"><span className="nt-ic"><I n="check" /></span><span className="grow"><span className="h3">{n.title}</span><span className="small">{n.body}</span></span><span className="nt-time">{n.at}</span></div></article>
        ))}</> : <div className="card dashed" style={{ textAlign: "center" }}><p className="h3">You’re all caught up</p><p className="small" style={{ marginTop: 4 }}>Reminders show up here.</p></div>}
        <ReminderSwitch />
      </div></div><Tabs on="Home" /></section>
  );
}
function ReminderSwitch() {
  const [on, setOn] = useState(true);
  return (
    <div className="card nt-settings"><div className="row"><span className="grow stack" style={{ gap: 2 }}><span className="h3">Class reminders</span><span className="small">{on ? "15 min before each class" : "Off"}</span></span>
      <button type="button" className={`switch${on ? " on" : ""}`} role="switch" aria-checked={on} aria-label="Class reminders" onClick={() => setOn(!on)}><span /></button></div></div>
  );
}

/* ---------- 06C lock screen: how the reminder arrives when the phone is locked ---------- */
export function Lock() {
  const { S, set } = useWF();
  useEffect(() => { set((d) => { if (!d.saved) d.saved = copySchedule(); if (!d.notes.some((x) => x.id === "remind")) { const n = reminderNote(d); if (n) addNote(d, n); } d.now = W.reminderDemo.at; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const n = S.notes.find((x) => x.id === "remind"), t = fmtMin(W.reminderDemo.at).replace(/ (AM|PM)/, "");
  return (
    <section className="view lock">
      <div className="lk-bg" aria-hidden="true"><svg viewBox="110 180 200 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{CAMPUS.shapes.filter((x: any) => !x.line).map((x: any, i: number) => <path key={i} d={x.d} fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.14)" strokeWidth=".5" />)}</svg></div>
      <div className="lk-top"><span className="lk-lock"><I n="lock" /></span><p className="lk-day">{day(W.today.day)}</p><p className="lk-time">{t}</p></div>
      {n && <div className="lk-stack">
        <article className="lk-note">
          <div className="nt-head"><span className="push-ic"><img src="/wf/logo.png" alt="" /></span><span className="grow"><span className="nt-app">WayFinder</span></span><span className="nt-time">now</span></div>
          <h2 className="lk-title">{n.title}</h2><p className="lk-body">{n.body}</p>
          <div className="nt-map lk-map"><MiniRoute /><span className="nt-map-l">CICT → {n.room}</span></div>
          <div className="lk-actions"><Link className="lk-btn primary" to={n.map!}><I n="map" /> Show on map</Link><Link className="lk-btn" to={n.cls!}>View class</Link></div>
        </article>
        <div className="lk-older" aria-hidden="true" /></div>}
      <div className="lk-foot"><span className="lk-home" aria-hidden="true" /></div>
    </section>
  );
}
