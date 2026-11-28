/* 00A–04: splash → three intro slides → sign-in → profile setup. Sign-in is simulated (see HANDOFF.md in the prototype). */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CAMPUS, GoogleG, I, Needle, ROLES, W, YEARS, college, copySchedule, initials, pfBlank, pfLine, pfName, pfSample, useWF, type Profile } from "../core";
import { esc, toastHtml, useBack } from "../ui/chrome";

const Emblem = ({ cls }: { cls: string }) => <img src="/wf/emblem-white-flat.png" alt="" width={457} height={457} className={cls} />;
const Wordmark = ({ cls }: { cls: string }) => <img src="/wf/logo-lockup-white.png" alt="WVSU WayFinder" width={881} height={399} className={cls} />;

/* ---------- 00A splash: the lockup assembles, then hands over to the intro ---------- */
export function Welcome({ signing = false }: { signing?: boolean }) {
  const nav = useNavigate(), { reduced } = useWF();
  useEffect(() => { if (signing) return; const t = setTimeout(() => nav("/intro", { replace: true }), reduced ? 900 : 2300); return () => clearTimeout(t); }, [nav, reduced, signing]);
  return (
    <section className={`view splash${signing ? " signing" : ""}`}>
      <div className="sp-glow" aria-hidden="true" />
      <h1 className="sp-lockup"><Emblem cls="sp-emblem" /><span className="sp-rule" aria-hidden="true" /><Wordmark cls="sp-wm" /></h1>
      {signing
        ? <div className="si-status" role="status"><span className="si-spin" aria-hidden="true" /><p className="si-title">Signing you in</p><p className="si-sub">Checking your WVSU account…</p></div>
        : <><p className="sp-uni">West Visayas State University</p><button className="sp-tap" aria-label="Continue" onClick={() => nav("/intro")} /></>}
    </section>
  );
}
export function SigningIn() {
  const nav = useNavigate(), { S, set } = useWF();
  useEffect(() => {
    const t = setTimeout(() => {
      set((d) => { d.signed = true; if (!d.firstTime) d.saved = d.saved || copySchedule(); d.toast = toastHtml(`Signed in as <b>${W.student.email}</b>`); });
      nav(S.profile ? "/home" : "/profile", { replace: true });
    }, 1100);
    return () => clearTimeout(t);
  }, [nav, set, S.profile]);
  return <Welcome signing />;
}

/* ---------- intro slides ---------- */
const INTRO = [
  { title: "Your next class, at a glance.", body: "See when it starts and which room it’s in the moment you open the app.", art: "next" },
  { title: "Walk there, turn by turn.", body: "Preview the path across campus before you set off.", art: "walk" },
  { title: "Scan your timetable once.", body: "WayFinder reads your WVSU schedule. You check every class before it’s saved.", art: "scan" },
];
function routeFrame(pad: number[]) {
  const r = W.routes["cict-building>quezon-hall"], xs = r.pts.map((q: number[]) => q[0]), ys = r.pts.map((q: number[]) => q[1]);
  const x0 = Math.min(...xs) - pad[0], y0 = Math.min(...ys) - pad[1], w = Math.max(...xs) - x0 + pad[2], h = Math.max(...ys) - y0 + pad[3];
  const near = CAMPUS.shapes.filter((s: any) => !s.line && s.cx > x0 - 40 && s.cx < x0 + w + 40 && s.cy > y0 - 40 && s.cy < y0 + h + 40);
  const d = "M" + r.pts.map((q: number[]) => q.join(" ")).join(" L");
  return { r, x0, y0, w, h, near, d, e: r.pts[r.pts.length - 1], s0: r.pts[0] };
}
function IntroRoute({ play }: { play: boolean }) {
  const { reduced } = useWF();
  const { x0, y0, w, h, near, d, e, s0 } = routeFrame([16, 14, 18, 14]);
  const pathRef = useRef<SVGPathElement>(null), headRef = useRef<SVGGElement>(null);
  useEffect(() => {
    const path = pathRef.current, head = headRef.current; if (!path || !head || !path.getTotalLength) return;
    const L = path.getTotalLength();
    const put = (dd: number) => { const q = path.getPointAtLength(Math.max(0.01, dd)), q2 = path.getPointAtLength(Math.max(0, dd - 0.6)); path.setAttribute("stroke-dasharray", `${dd} ${L + 1}`); head.setAttribute("transform", `translate(${q.x} ${q.y}) rotate(${Math.atan2(q.y - q2.y, q.x - q2.x) * 180 / Math.PI})`); };
    if (!play || reduced) { put(L); return; }
    let raf = 0; const t0 = performance.now() + 250, dur = 2600, ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    put(0.01); const step = (now: number) => { const x = Math.max(0, Math.min(1, (now - t0) / dur)); put(Math.max(0.01, ease(x) * L)); if (x < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [play, reduced]);
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Walking route from CICT Building to Quezon Hall">
      {near.map((s: any, i: number) => <path key={i} d={s.d} fill={s.name === "Quezon Hall" ? "#F3B53A" : s.name === "CICT Building" ? "#9FC3E8" : "#E7DFCE"} stroke={s.name === "Quezon Hall" ? "#B87900" : "#D3C6AC"} strokeWidth=".45" />)}
      <path d={d} fill="none" stroke="#FFFBF3" strokeWidth="4.6" strokeLinejoin="round" strokeLinecap="round" />
      <path ref={pathRef} className="ia-route" d={d} fill="none" stroke="#123A9C" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={s0[0]} cy={s0[1]} r="3.4" fill="#2E6FB8" stroke="#fff" strokeWidth="1.3" />
      <g transform={`translate(${e[0]} ${e[1]})`}><circle r="4" fill="#F3B53A" stroke="#132D6B" strokeWidth="1.1" /></g>
      <g ref={headRef} className="ia-head"><g transform="scale(.1)"><path d="M38 0 L-44 -44 L-24 0 Z" fill="#132D6B" /><path d="M38 0 L-24 0 L-44 44 Z" fill="#3F8FD2" /><path d="M38 0 L-44 -44 L-24 0 L-44 44 Z" fill="none" stroke="#FFFBF3" strokeWidth="8" strokeLinejoin="round" /></g></g>
    </svg>
  );
}
function IntroArt({ kind, on }: { kind: string; on: boolean }) {
  if (kind === "next") {
    const C = 2 * Math.PI * 42;
    return (
      <div className="ia-next"><div className="ia-chip"><Needle size={14} /> Starts in 20 min</div>
        <div className="ia-card"><div className="dial ia-dial"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" fill="none" stroke="#E6EEF9" strokeWidth="9" /><circle className="ia-arc" cx="50" cy="50" r="42" fill="none" stroke="#1B3C8A" strokeWidth="9" strokeLinecap="round" strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * 0.33).toFixed(1)} style={{ ["--c" as string]: C.toFixed(1) }} transform="rotate(-90 50 50)" /></svg><span className="dial-num">20</span><span className="dial-unit">min</span></div>
          <div className="ia-info"><p className="nc-code">CIT 213</p><p className="small" style={{ whiteSpace: "nowrap" }}>Wed · 7:00–10:00 AM</p></div></div>
        <div className="ia-room"><span className="label">ROOM</span><span className="room">ICT 306</span></div></div>
    );
  }
  if (kind === "walk") return <div className="ia-walk"><IntroRoute play={on} /></div>;
  return (
    <div className="ia-scan"><div className="ia-photo"><img src="/wf/schedule.png" alt="" /><span className="ia-line" />
      {W.schedule.map((x: any, i: number) => <span key={i} className="ia-row" style={{ top: `${(x.row / 245 * 100).toFixed(1)}%`, ["--i" as string]: i }} />)}</div>
      <div className="ia-count"><I n="check" /> 7 of 7 subjects read</div></div>
  );
}
export function Intro() {
  const [p, setP] = useSearchParams(), nav = useNavigate(), { reduced } = useWF();
  const i0 = Math.max(0, Math.min(2, +(p.get("i") || 0)));
  const [i, setI] = useState(i0);
  const track = useRef<HTMLDivElement>(null);
  const goTo = (k: number) => { const tr = track.current; if (tr) tr.scrollTo({ left: k * tr.clientWidth, behavior: reduced ? "auto" : "smooth" }); };
  useEffect(() => { const tr = track.current; if (tr) tr.scrollLeft = i0 * tr.clientWidth; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const tr = track.current; if (!tr) return; let t = 0;
    const on = () => { clearTimeout(t); t = window.setTimeout(() => { const k = Math.round(tr.scrollLeft / tr.clientWidth); setI(k); setP({ i: String(k) }, { replace: true }); }, 60); };
    tr.addEventListener("scroll", on); return () => tr.removeEventListener("scroll", on);
  }, [setP]);
  return (
    <section className="view intro" data-i={i}>
      <header className="in-top"><span className="in-step" aria-live="polite">{i + 1} of 3</span><Link className="in-skip" to="/login">Skip</Link></header>
      <div className="in-track" id="intrack" ref={track}>
        {INTRO.map((x, k) => (
          <article key={k} className={`in-slide${k === i ? " on" : ""}`} aria-roledescription="slide" aria-label={`${k + 1} of 3`}>
            <div className="in-art"><IntroArt kind={x.art} on={k === i} /></div>
            <div className="in-copy"><h1 className="in-title">{x.title}</h1><p className="in-body">{x.body}</p></div>
          </article>
        ))}
      </div>
      <footer className="in-foot">
        <div className="in-dots" role="tablist" aria-label="Intro slides">{INTRO.map((_, k) => <button key={k} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} onClick={() => goTo(k)} />)}</div>
        <button className={`in-next${i === 2 ? " last" : ""}`} onClick={() => (i === 2 ? nav("/login") : goTo(i + 1))}><span className="lbl">Get started</span><I n="arrow" /></button>
      </footer>
    </section>
  );
}

/* ---------- sign-in: a gold line draws across the hero while the folded arrowhead travels it ---------- */
const TRAILN = [[-0.05, 0.86], [0.15, 0.86], [0.24, 0.69], [0.39, 0.71], [0.55, 0.74], [0.61, 0.95], [0.77, 0.83], [0.92, 0.73], [0.86, 0.48], [0.93, 0.30]];
const trailD = (w: number, h: number) => { const Q = TRAILN.map(([x, y]) => `${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`); return `M ${Q[0]} C ${Q[1]} ${Q[2]} ${Q[3]} C ${Q[4]} ${Q[5]} ${Q[6]} C ${Q[7]} ${Q[8]} ${Q[9]}`; };
function Hero({ play }: { play: boolean }) {
  const ref = useRef<SVGSVGElement>(null), { reduced } = useWF();
  useEffect(() => {
    const svg = ref.current; if (!svg) return;
    const path = svg.querySelector<SVGPathElement>('[id="Trail"]'); if (!path || !path.getTotalLength) return;
    const fit = () => { const w = Math.round(svg.clientWidth), h = Math.round(svg.clientHeight); if (!w || !h) return; svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.querySelectorAll("path[id^=Trail]").forEach((p) => p.setAttribute("d", trailD(w, h))); };
    const place = (t: number) => { fit(); const L = path.getTotalLength(), d = L * t, q = path.getPointAtLength(Math.max(0.01, d)), q2 = path.getPointAtLength(Math.max(0, d - 1));
      path.setAttribute("stroke-dasharray", `${d.toFixed(1)} ${L.toFixed(1)}`);
      svg.querySelector("#Arrowhead")!.setAttribute("transform", `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) rotate(${(Math.atan2(q.y - q2.y, q.x - q2.x) * 180 / Math.PI).toFixed(1)})`); };
    if (!play || reduced) { place(1); if (typeof ResizeObserver === "undefined") return; const ro = new ResizeObserver(() => place(1)); ro.observe(svg); return () => ro.disconnect(); }
    let raf = 0; const t0 = performance.now() + 380, dur = 1500, ease = (x: number) => 1 - Math.pow(1 - x, 3);
    place(0.001); const step = (now: number) => { const x = Math.max(0, Math.min(1, (now - t0) / dur)); place(Math.max(0.001, ease(x))); if (x < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [play, reduced]);
  const T = trailD(390, 320);
  return (
    <div className="lg-hero">
      <svg ref={ref} className="lg-trail" viewBox="0 0 390 320" aria-hidden="true">
        <path id="Trail ghost" d={T} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
        <path id="Trail" d={T} fill="none" stroke="#F3B53A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <g id="Arrowhead"><path d="M15 0 L-14 -13 L-7 0 Z" fill="#FFFFFF" /><path d="M15 0 L-7 0 L-14 13 Z" fill="#F3B53A" /></g>
      </svg>
      <div className="lg-brand"><h1 className="lg-lockup"><Emblem cls="lg-emblem" /><span className="lg-rule" aria-hidden="true" /><Wordmark cls="lg-wm" /></h1></div>
    </div>
  );
}
export function Login({ google = false }: { google?: boolean }) {
  const [p] = useSearchParams(), nav = useNavigate(), { S, set } = useWF();
  const [play] = useState(() => !S.introPlayed || !!p.get("replay"));
  useEffect(() => { if (!S.introPlayed) set((d) => { d.introPlayed = true; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!google) return; const t = setTimeout(() => nav("/signing-in", { replace: true }), 1600); return () => clearTimeout(t); }, [google, nav]);
  return (
    <section className="view login2">
      <Hero play={play && !google} />
      <div className="lg-sheet">
        {p.get("out") && <p className="lg-out" role="status"><I n="check" /><span>You’re logged out.</span></p>}
        <h2 className="lg-title">Find your next class.</h2>
        <p className="lg-body">Use your <b>@wvsu.edu.ph</b> account to see your schedule and find your room.</p>
        <div className="lg-actions">
          <button className="btn google wide" type="button" onClick={() => nav("/google")}><span className="g"><GoogleG /></span><span className="lbl">Continue with Google</span><span className="btn-spin" aria-hidden="true" /></button>
          {p.get("state") === "cancelled" && <p className="lg-err" role="alert"><I n="alert" /><span>Sign-in cancelled. Nothing changed. You can try again.</span></p>}
          <div className="lg-or" aria-hidden="true"><span>or</span></div>
          <Link className="btn outline wide" to="/map?guest=1"><I n="map" /> Explore campus map</Link>
        </div>
        <p className="lg-fine">Only WVSU Google accounts can sign in. WayFinder never posts to your account.</p>
      </div>
      {google && <>
        <div className="scrim" />
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Signing in with Google">
          <div className="grab" />
          <div className="stack gap-12" style={{ alignItems: "center", textAlign: "center", padding: "8px 0 4px" }}>
            <div className="spinner" aria-hidden="true" /><h2 className="h2">Continue in Google</h2>
            <p className="body">Choose your <b style={{ color: "var(--ink)" }}>@wvsu.edu.ph</b> account in the Google window.</p>
          </div>
          <Link className="btn outline wide" to="/login?state=cancelled" replace style={{ marginTop: 18 }}>Cancel</Link>
        </div>
      </>}
    </section>
  );
}
export function WrongAccount() {
  return (
    <section className="view login2"><Hero play={false} />
      <div className="lg-sheet">
        <span className="tag gold lg-tag"><I n="user" /> Not a WVSU account</span>
        <h2 className="lg-title">Use your WVSU account</h2>
        <p className="lg-body"><b>{W.student.personal}</b> is a personal Google account. WayFinder works with your <b>@wvsu.edu.ph</b> account.</p>
        <div className="lg-actions">
          <Link className="btn google wide" to="/google"><span className="g"><GoogleG /></span><span className="lbl">Choose another account</span></Link>
          <div className="lg-or" aria-hidden="true"><span>or</span></div>
          <Link className="btn outline wide" to="/map?guest=1"><I n="map" /> Explore campus map</Link>
        </div>
        <Link className="link lg-back" to="/login">Back to start</Link>
      </div>
    </section>
  );
}

/* ---------- profile setup: right after Google sign-in, three short steps ---------- */
function pfCheck(x: Profile, step: number) {
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!x.first.trim()) e.first = "Enter your first name.";
    if (!x.last.trim()) e.last = "Enter your last name.";
    if (!x.id.trim()) e.id = x.role === "student" ? "Enter your student number. It’s on your WVSU ID." : "Enter your employee number.";
    else if (!/^[A-Za-z0-9-]{6,14}$/.test(x.id.trim())) e.id = "Use 6 to 14 letters, numbers or hyphens, as printed on your ID.";
  }
  if (step === 2) {
    if (x.role !== "staff" && !x.college) e.college = "Choose your college.";
    if (x.role === "student") { if (!x.program) e.program = "Choose your course."; if (!x.year) e.year = "Choose your year level."; if (!x.section.trim()) e.section = "Enter your section, for example B."; }
    if (x.role === "faculty" && !x.dept.trim()) e.dept = "Enter your department.";
    if (x.role === "staff") { if (!x.office) e.office = "Choose your office."; if (!x.position.trim()) e.position = "Enter your position."; }
  }
  if (step === 3 && !x.consent) e.consent = "Tick the box to agree before you finish.";
  return e;
}
function IdCard({ x }: { x: Profile }) {
  const c = college(x.college), off = x.office && W.offices[x.office];
  return (
    <div className="idc"><div className="idc-top"><img src="/wf/emblem-white-flat.png" alt="" width={34} height={34} /><span><b>West Visayas State University</b><span>{x.campus || ""}</span></span></div>
      <div className="idc-body"><span className="idc-ph" aria-hidden="true">{initials(x)}</span><div className="idc-who"><span className="idc-role">{ROLES.find((r) => r[0] === x.role)![1]}</span><p className="idc-name">{pfName(x) || "Your name"}</p>
        <p className="idc-line">{pfLine(x) || "Your course and year"}</p>{c ? <p className="idc-col">{c.name}</p> : off ? <p className="idc-col">{W.places[off.place] ? W.places[off.place].name : ""}</p> : null}</div></div>
      <div className="idc-foot"><span><span className="idc-k">{x.role === "student" ? "Student no." : "Employee no."}</span><b>{x.id || "—"}</b></span><span className="idc-mail">{W.student.email}</span></div></div>
  );
}

type PfCtx = { x: Profile; err: Record<string, string>; put: (k: keyof Profile, v: string | boolean) => void };
const pfInv = (err: Record<string, string>, k: string) => (err[k] ? { "aria-invalid": true, "aria-describedby": `err-${k}` } : {});
function Err({ k, err }: { k: string; err: Record<string, string> }) {
  return err[k] ? <p className="pf-err" id={`err-${k}`} role="alert"><I n="alert" /><span>{err[k]}</span></p> : null;
}
function Input({ k, label, hint, c, ...attrs }: { k: keyof Profile; label: ReactNode; hint?: string; c: PfCtx; [a: string]: unknown }) {
  return (
    <label className={`pf-f${c.err[k] ? " bad" : ""}`}><span className="label">{label}</span>{hint && <span className="pf-hint">{hint}</span>}
      <span className="field"><input name={k} defaultValue={(c.x[k] as string) || ""} {...attrs} {...pfInv(c.err, k)} /></span><Err k={k} err={c.err} /></label>
  );
}
function Select({ k, label, opts, ph, c }: { k: keyof Profile; label: string; opts: [string, string][]; ph: string; c: PfCtx }) {
  return (
    <label className={`pf-f${c.err[k] ? " bad" : ""}`}><span className="label">{label}</span>
      <span className="field pf-sel"><select name={k} value={(c.x[k] as string) || ""} onChange={(e) => c.put(k, e.target.value)} {...pfInv(c.err, k)}><option value="">{ph}</option>{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select><I n="chev" cls="ico pf-chev" /></span><Err k={k} err={c.err} /></label>
  );
}
export function ProfileSetup() {
  const [p] = useSearchParams(), nav = useNavigate(), { S, set } = useWF(), goBack = useBack("/home");
  const step = Math.max(1, Math.min(3, +(p.get("step") || 1))), edit = !!p.get("edit");
  useEffect(() => {
    if (p.get("fill")) set((d) => { d.pf = pfSample(); });
    else if (edit && !S.pf) set((d) => { d.pf = { ...(d.profile || pfSample()), consent: true }; });
    else if (!S.pf) set((d) => { d.pf = pfBlank(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const x = S.pf || pfBlank(), err = S.pfErr || {}, stu = x.role === "student";
  const qs2 = (n: number) => `/profile?step=${n}${edit ? "&edit=1" : ""}`;
  const put = (k: keyof Profile, v: string | boolean) => set((d) => { d.pf = { ...(d.pf || pfBlank()), [k]: v } as Profile; if (k === "college") d.pf.program = ""; if (d.pfErr) delete d.pfErr[k as string]; });
  const titles = ["About you", stu ? "Your course" : x.role === "faculty" ? "Where you teach" : "Where you work", edit ? "Your profile" : "Check your details"];
  const subs = ["Your name came from your Google account. Fix it if it’s wrong.", stu ? "WayFinder uses this to suggest your rooms and your college’s offices." : "WayFinder uses this to point you to your building and offices.", edit ? "This is what WayFinder knows about you." : "Make sure everything is right before you start."];
  const c3 = { x, err, put };
  const inv = (k: string) => (err[k] ? { "aria-invalid": true, "aria-describedby": `err-${k}` } : {});
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget), cur: Profile = { ...x };
    fd.forEach((v, k) => { if (k !== "consent") (cur as any)[k] = String(v); });
    if (step === 3 && !edit) cur.consent = fd.has("consent");
    const errs = pfCheck(cur, edit && step === 3 ? 0 : step);
    if (Object.keys(errs).length) { set((d) => { d.pf = cur; d.pfErr = errs; }); setTimeout(() => (document.querySelector("[aria-invalid=true]") as HTMLElement | null)?.focus(), 0); return; }
    if (step < 3) { set((d) => { d.pf = cur; d.pfErr = null; }); nav(qs2(step + 1)); return; }
    set((d) => { d.profile = cur; d.pf = null; d.pfErr = null; d.toast = toastHtml(edit ? "Profile saved" : `Welcome, <b>${esc(cur.first)}</b>. Your profile is set up.`); });
    nav("/home");
  };
  const next = step < 3 ? "Continue" : edit ? "Save changes" : "Finish setup";
  let body;
  if (step === 1) body = <>
    <div className="pf-f"><span className="label" id="role-l">I am a</span><div className="seg" role="radiogroup" aria-labelledby="role-l">{ROLES.map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={x.role === v} aria-pressed={x.role === v} onClick={() => put("role", v)}>{t}</button>)}</div></div>
    <Input c={c3} k="first" label="First name" autoComplete="given-name" autoCapitalize="words" />
    <div className="pf-row"><Input c={c3} k="mi" label={<>M.I. <span className="pf-opt">(optional)</span></>} maxLength={3} autoComplete="additional-name" aria-label="Middle initial, optional" /><Input c={c3} k="last" label="Last name" autoComplete="family-name" /></div>
    <Input c={c3} k="id" label={stu ? "Student number" : "Employee number"} hint="As printed on your WVSU ID" autoComplete="off" spellCheck={false} placeholder="e.g. 2023M0482" />
    <div className="pf-f"><span className="label">WVSU email</span><span className="field fake pf-locked"><span className="g-mini"><GoogleG /></span>{W.student.email}</span></div>
  </>;
  else if (step === 2) {
    const c = college(x.college);
    body = <>
      {x.role !== "staff" && <Select c={c3} k="college" label="College" opts={W.colleges.map((k: any) => [k.id, `${k.name} (${k.short})`])} ph="Choose your college" />}
      {stu ? <>
        <Select c={c3} k="program" label="Course" opts={(c ? c.programs : []).map((v: string) => [v, v])} ph={c ? "Choose your course" : "Choose your college first"} />
        <div className={`pf-f${err.year ? " bad" : ""}`}><span className="label" id="yr-l">Year level</span><div className="seg pf-years" role="radiogroup" aria-labelledby="yr-l" {...inv("year")}>{YEARS.map((v) => <button key={v} type="button" role="radio" aria-checked={x.year === v} aria-pressed={x.year === v} onClick={() => put("year", v)}>{v}</button>)}</div><Err k="year" err={err} /></div>
        <Input c={c3} k="section" label="Section" hint="The letter or number after your year, like 3-B" maxLength={6} autoComplete="off" placeholder="e.g. B" />
      </> : x.role === "faculty" ? <Input c={c3} k="dept" label="Department" placeholder="e.g. Information Technology" />
        : <><Select c={c3} k="office" label="Office" opts={Object.entries(W.offices).map(([k, o]: [string, any]) => [k, o.name] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]))} ph="Choose your office" /><Input c={c3} k="position" label="Position" placeholder="e.g. Administrative Aide" /></>}
      <Select c={c3} k="campus" label="Campus" opts={W.campuses.map((v: string) => [v, v])} ph="Choose your campus" />
    </>;
  } else body = <>
    <IdCard x={x} />
    <div className="list pf-sum">
      <Link className="item" to={qs2(1)}><span className="grow"><span className="label">Name and {stu ? "student" : "employee"} number</span><span className="h3">{pfName(x)} · {x.id}</span></span><span className="pf-edit">Edit</span></Link>
      <Link className="item" to={qs2(2)}><span className="grow"><span className="label">{stu ? "Course, year and section" : x.role === "faculty" ? "College and department" : "Office and position"}</span><span className="h3">{pfLine(x)}</span><span className="small">{x.campus}</span></span><span className="pf-edit">Edit</span></Link>
    </div>
    {!edit && <><label className={`pf-consent${err.consent ? " bad" : ""}`}><input type="checkbox" name="consent" defaultChecked={!!x.consent} {...inv("consent")} /><span className="pf-box" aria-hidden="true"><I n="check" /></span><span>I agree that WayFinder may keep these details on this phone to show my schedule and directions, as allowed by the Data Privacy Act of 2012. I can change them anytime.</span></label><Err k="consent" err={err} /></>}
  </>;
  const logout = edit && p.get("logout");
  return (
    <section className="view pfview">
      <header className="pf-top">
        {step > 1 || edit ? <button className="back" type="button" onClick={() => (step > 1 ? nav(qs2(step - 1)) : goBack())}><I n="back" /><span>Back</span></button>
          : <img className="pf-logo" src="/wf/logo-lockup.png" alt="WVSU WayFinder" width={881} height={399} />}
        {!edit && <span className="pf-step" aria-live="polite">Step {step} of 3</span>}
      </header>
      {!edit && <div className="pf-bar" role="progressbar" aria-label="Profile setup" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>{[1, 2, 3].map((n) => <span key={n} className={n < step ? "done" : n === step ? "on" : ""} />)}</div>}
      <div className="scroll pf-scroll"><form key={`${step}-${x.role}`} className="pad pf-form" onSubmit={submit} noValidate>
        <div className="pf-head"><h1 className="pf-title">{titles[step - 1]}</h1><p className="pf-sub">{subs[step - 1]}</p></div>
        {body}
        <div className="pf-actions"><button className="btn primary wide" type="submit">{next}<I n={step < 3 ? "arrow" : "check"} /></button>
          {step === 1 && !edit && <Link className="link" to="/login">Not you? Use another account</Link>}
          {edit && step === 3 && <Link className="btn wide pf-logout" to="/profile?step=3&edit=1&logout=1"><I n="logout" /> Log out</Link>}</div>
      </form></div>
      {logout && <>
        <Link className="scrim" to="/profile?step=3&edit=1" aria-label="Cancel" />
        <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="lo-title"><div className="grab" />
          <h2 className="h2" id="lo-title">Log out of WayFinder?</h2>
          <p className="body" style={{ marginTop: 6 }}>Sign back in with your WVSU Google account.</p>
          <LogoutButtons />
        </div>
      </>}
    </section>
  );
}
function LogoutButtons() {
  const nav = useNavigate(), { reset } = useWF();
  return (
    <div className="stack gap-8" style={{ marginTop: 18 }}>
      <button className="btn wide pf-logout-go" type="button" onClick={() => { reset(); nav("/login?out=1", { replace: true }); }}>Log out</button>
      <Link className="btn outline wide" to="/profile?step=3&edit=1">Cancel</Link>
    </div>
  );
}
