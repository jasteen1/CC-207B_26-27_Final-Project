/* 26–32: Directory page, office page, process page, Ask WayFinder. */
import { type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { I, Needle, W, asset, enc, range, useWF, type State } from "../core";
import { Bar, LockupBar, Tabs, Toast } from "../ui/chrome";
import { Silhouette, where } from "./Map";
import { TYPE_LABEL, matchRoom, useRoomDirectory, type RoomEntry } from "../data/roomDirectory";

/* ---------- process helpers ---------- */
/** The buildings a process sends you to, in walking order (consecutive steps in one building share a stop). */
export function procStops(pr: any) {
  const out: { place: string; steps: number[]; offices: string[] }[] = [];
  pr.steps.forEach((st: any, i: number) => { if (!st.place) return; const last = out[out.length - 1];
    if (last && last.place === st.place) last.steps.push(i + 1); else out.push({ place: st.place, steps: [i + 1], offices: [] });
    if (st.office) out[out.length - 1].offices.push(st.office); });
  return out;
}
export const procDone = (S: State, id: string) => S.procDone[id] || [];
export const nextOf = (pr: any, done: number[]) => [...Array(pr.steps.length).keys()].map((i) => i + 1).find((k) => !done.includes(k)) || null;
export const stopState = (stp: { steps: number[] }, done: number[], nextStep: number | null) => stp.steps.every((k) => done.includes(k)) ? "done" : stp.steps.includes(nextStep as number) ? "now" : "todo";
export const shortOf = (oid: string) => W.offices[oid].short || W.offices[oid].name;
export const ProgressBar = ({ done, total, label }: { done: number; total: number; label: string }) => (
  <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}><span style={{ width: `${(done / total * 100).toFixed(1)}%` }} /></div>
);
const Ext = ({ href, label, cls = "link" }: { href: string; label: string; cls?: string }) => <a className={cls} href={href} target="_blank" rel="noopener">{label} <I n="ext" /></a>;
function ProcCard({ id, pr }: { id: string; pr: any }) {
  const { S } = useWF(), d = procDone(S, id).length, n = pr.steps.length, stops = procStops(pr);
  const sub = pr.order ? `Start online, then ${pr.order.slice(1).map((o: string[]) => o[0]).join(" → ")}.` : `${stops.length} buildings: ${stops.map((x) => W.places[x.place].name).join(" → ")}.`;
  return (
    <Link className="proc-card" to={`/directory/process/${id}`}>
      <span className="proc-ic"><I n="list" /></span><span className="grow"><span className="h3">{pr.title}</span><span className="small">{sub}</span>
        <span className="pc-prog"><ProgressBar done={d} total={n} label={`${d} of ${n} steps done`} /><span className="pc-n">{d ? `${d} of ${n} done` : `${n} steps`}</span></span></span><I n="chev" cls="ico chev" /></Link>
  );
}
const officeMatch = (o: any, q: string) => !q || [o.name, W.places[o.place].name, ...(W.places[o.place].aka || []), ...(o.keywords || [])].join(" ").toLowerCase().includes(q);

/* ---------- 26–26C, 29–30 Directory ---------- */
export function Directory() {
  const { S } = useWF(), [p] = useSearchParams(), nav = useNavigate(), loc = useLocation();
  const tab = p.get("tab") || "offices", raw = p.get("q") || "", q = raw.trim().toLowerCase(), signed = S.signed;
  const rooms = useRoomDirectory();
  const chips: [string, string][] = [["offices", "Offices"], ["rooms", "Rooms"], ["processes", "Processes"], ["buildings", "Buildings"], ["people", "People"]];
  const noResults = (kind: string) => {
    const other = kind === "office" ? "buildings" : "offices";
    return (
      <div className="card stack gap-12"><p className="h3">No {kind} called “{raw}” yet</p><p className="small">The directory lists places with a confirmed record. Try a shorter name, or ask WayFinder.</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}><Link className="btn sm outline" to={`/directory?tab=${other}&q=${enc(q)}`}>Search {other}</Link><button className="btn sm outline" onClick={() => nav("/ask", { state: { back: loc.pathname + loc.search } })}>Ask WayFinder</button></div></div>
    );
  };
  let content: ReactNode = null;
  if (tab === "offices") {
    const hits = Object.entries(W.offices).filter(([, o]) => officeMatch(o, q)) as [string, any][];
    const procHits = q ? (Object.entries(W.processes) as [string, any][]).filter(([, pr]) => [pr.title, ...pr.keywords].join(" ").toLowerCase().includes(q)) : [];
    const byPlace: Record<string, [string, any][]> = {}; hits.forEach(([id, o]) => (byPlace[o.place] = byPlace[o.place] || []).push([id, o]));
    content = hits.length ? <>
      {Object.entries(byPlace).map(([pid, list]) => { const pl = W.places[pid], floors = [...new Set(list.map(([, o]) => o.floor))].filter(Boolean).sort();
        return (
          <section key={pid} className="dgroup"><header className="dg-head"><Silhouette shape={pl.shape} /><div className="grow"><h2 className="h3">{pl.name}</h2><p className="small">{list.length} office{list.length > 1 ? "s" : ""}{floors.length ? `, floor${floors.length > 1 ? "s" : ""} ${floors.join(" and ")}` : ""}</p></div></header>
            <div className="dg-list">{list.map(([id, o]) => <Link key={id} className="item office-row" to={`/directory/office/${id}`}><span className="grow"><span className="h3">{o.name}</span><span className="small">{where(o)}</span></span><I n="chev" cls="ico chev" /></Link>)}</div></section>);
      })}
      {procHits.length > 0 && <section className="dgroup"><header className="dg-head"><span className="proc-ic"><I n="list" /></span><div className="grow"><h2 className="h3">Related process</h2></div></header>
        <div className="dg-list">{procHits.map(([id, pr]) => <Link key={id} className="item" to={`/directory/process/${id}`}><span className="grow"><span className="h3">{pr.title}</span><span className="small">{W.offices[pr.office].name} · {pr.steps.length} steps</span></span><I n="chev" cls="ico chev" /></Link>)}</div></section>}
    </> : noResults("office");
  }
  if (tab === "rooms") content = <RoomsTab rooms={rooms.rooms} live={rooms.live} q={raw.trim()} none={() => noResults("room")} />;
  if (tab === "processes") { const list = (Object.entries(W.processes) as [string, any][]).filter(([, pr]) => !q || [pr.title, ...pr.keywords].join(" ").toLowerCase().includes(q));
    content = <div className="stack gap-12">{list.length ? list.map(([id, pr]) => <ProcCard key={id} id={id} pr={pr} />) : noResults("process")}</div>; }
  if (tab === "buildings") {
    const rows = (Object.entries(W.places) as [string, any][]).filter(([, pl]) => !q || [pl.name, ...(pl.aka || [])].join(" ").toLowerCase().includes(q));
    rows.sort((a, b) => (+!!b[1].photo - +!!a[1].photo) || (+((b[1].blueprints || []).length > 0) - +((a[1].blueprints || []).length > 0)) || a[1].name.localeCompare(b[1].name));
    content = rows.length ? <>
      <p className="small">{rows.filter(([, pl]) => pl.photo).length} with photos · {rows.filter(([, pl]) => (pl.blueprints || []).length).length} with floor plans · the rest show their map outline</p>
      <div className="bgrid">{rows.map(([id, pl]) => (
        <Link key={id} className={`bcard${pl.photo ? " has-photo" : ""}`} to={`/map/place/${id}`}>
          {pl.photo ? <span className="bc-img"><img src={asset(pl.photo.src)} alt="" loading="lazy" style={pl.photo.focus ? { objectPosition: pl.photo.focus } : undefined} /></span> : <span className="bc-img empty"><Silhouette shape={pl.shape} size={46} /><span>No photo yet</span></span>}
          <span className="bc-body"><span className="h3">{pl.name}</span><span className="bc-tags">{(pl.blueprints || []).length || pl.plans ? <span className="tag">Floor plan</span> : pl.shape ? <span className="tag off">Outline only</span> : <span className="tag off">No floor plan</span>}{!pl.shape && <span className="tag off">Not on map</span>}</span></span></Link>))}</div>
    </> : noResults("building");
  }
  if (tab === "people") {
    const ppl = (W.people as any[]).filter((x) => !q || [x.name, x.role, x.unit].join(" ").toLowerCase().includes(q));
    const ini = (n: string) => n.replace(/^Ma\. /, "M ").split(/\s+/).filter((w) => /^[A-Z]/.test(w) && !/^[A-Z]\.$/.test(w) && !/^I+$/.test(w)).map((w) => w[0]);
    content = ppl.length ? <div className="list ppl">{ppl.map((x) => { const i2 = ini(x.name); return (
      <div key={x.name} className="item ppl-row"><span className="ppl-av" aria-hidden="true">{i2[0]}{i2[i2.length - 1]}</span>
        <span className="grow"><span className="h3">{x.name}<span className="ppl-cred">, {x.cred}</span></span><span className="ppl-role">{x.role}</span><span className="small">{x.unit}</span>
          <span className="ppl-ph">{x.phone || "No phone listed"}</span></span>
        {x.tel && <a className="icon-btn ppl-call" href={`tel:${x.tel}`} aria-label={`Call ${x.name}'s office`}><I n="phone" /></a>}</div>); })}</div>
      : noResults("person");
  }
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); nav(`/directory?tab=${tab}&q=${enc(String(new FormData(e.currentTarget).get("q") || ""))}`, { replace: true }); };
  return (
    <section className={`view${signed ? " has-tabs" : ""} dir2`}>{signed ? <LockupBar /> : <Bar title="Directory" back="/login" backLabel="Welcome" />}
      <div className="scroll" style={{ top: 60 }}><div className="pad stack gap-16" style={{ paddingBottom: 28 }}>
        <h1 className="h1">Directory</h1>
        <form className="field" role="search" onSubmit={submit}><I n="search" /><input name="q" key={raw} defaultValue={raw} placeholder={tab === "rooms" ? "Try “NAB 201”, “ICT 302” or “Dean’s Office”" : "Try “Registrar” or “transcript”"} aria-label="Search offices, processes and buildings" /></form>
        <div className="chips" role="tablist" aria-label="Directory sections">{chips.map(([k, l]) => <button key={k} role="tab" className="chip" aria-selected={k === tab} onClick={() => nav(`/directory?tab=${k}${q ? `&q=${enc(q)}` : ""}`, { replace: true })}>{l}</button>)}</div>
        {content}
      </div></div>{signed && <Tabs on="Directory" />}<Toast /></section>
  );
}

/* ---------- Rooms: every room and office on the blueprints, grouped by building ---------- */
function roomHref(r: RoomEntry) {
  if (!r.app || !W.places[r.app]) return null;
  const pl = W.places[r.app], key = pl.plans && pl.rooms ? (pl.rooms[r.label] ? r.label : pl.rooms[r.name] ? r.name : null) : null;
  return `/map/place/${r.app}${key ? `?room=${enc(key)}` : pl.plans && r.floor && pl.plans[r.floor] ? `?floor=${r.floor}` : ""}`;
}
const byFloorThenName = (a: RoomEntry, b: RoomEntry) => (a.floor ?? 99) - (b.floor ?? 99) || (a.code || a.name).localeCompare(b.code || b.name, undefined, { numeric: true });
function RoomRow({ r }: { r: RoomEntry }) {
  const href = roomHref(r), title = r.code ? r.label : r.name;
  const sub = [r.code && r.name !== r.label ? r.name : null, r.floor ? `Floor ${r.floor}` : "Floor not printed", TYPE_LABEL[r.type]].filter(Boolean).join(" · ");
  const body = <><span className="grow"><span className="h3">{title}</span><span className="small">{sub}</span></span>{href && <I n="chev" cls="ico chev" />}</>;
  return href ? <Link className="item office-row" to={href}>{body}</Link> : <div className="item office-row">{body}</div>;
}
function RoomsTab({ rooms, live, q, none }: { rooms: RoomEntry[]; live: boolean; q: string; none: () => ReactNode }) {
  const hits = rooms.filter((r) => matchRoom(r, q));
  if (!hits.length) return <>{none()}</>;
  const groups = new Map<string, RoomEntry[]>();
  hits.forEach((r) => groups.set(r.b, [...(groups.get(r.b) || []), r]));
  const list = [...groups.values()].sort((a, b) => a[0].building.localeCompare(b[0].building));
  return <>
    <p className="small">{hits.length} {hits.length === 1 ? "place" : "places"} in {list.length} {list.length === 1 ? "building" : "buildings"}{q ? "" : ", from the campus blueprints"}{live ? "" : " · offline copy"}</p>
    {list.map((rs) => { const r0 = rs[0], pl = r0.app ? W.places[r0.app] : null, floors = [...new Set(rs.map((r) => r.floor).filter(Boolean))].sort();
      const head = <header className="dg-head">{pl && pl.shape ? <Silhouette shape={pl.shape} /> : <span className="proc-ic"><I n="pin" /></span>}<div className="grow"><h2 className="h3">{r0.building}</h2><p className="small">{rs.length} room{rs.length > 1 ? "s" : ""}{floors.length ? `, floor${floors.length > 1 ? "s" : ""} ${floors.join(", ")}` : ""}</p></div></header>;
      const items = <div className="dg-list">{[...rs].sort(byFloorThenName).map((r) => <RoomRow key={r.id} r={r} />)}</div>;
      return q ? <section key={r0.b} className="dgroup">{head}{items}</section>
        : <details key={r0.b} className="dgroup"><summary style={{ listStyle: "none", cursor: "pointer" }}>{head}</summary>{items}</details>;
    })}
  </>;
}

/* ---------- 27 office page: name, location and map first; services; reporting line ---------- */
export function Office() {
  const { id = "" } = useParams(), { S, set } = useWF();
  const o = W.offices[id]; if (!o) return <Directory />;
  const pl = W.places[o.place];
  return (
    <section className={`view${S.signed ? " has-tabs" : ""} office2`}><Bar title={o.name} back="/directory" backLabel="Directory" />
      <div className="scroll" style={{ top: 60 }}><div className="pad stack gap-20" style={{ paddingBottom: 28 }}>
        {pl.photo && <div className="of-photo"><img src={asset(pl.photo.src)} alt={pl.name} /><span>{pl.name}</span></div>}
        <header className="of-head">{!pl.photo && <Silhouette shape={pl.shape} size={56} />}<div className="grow"><h1 className="h1">{o.name}</h1><p className="of-where"><I n="pin" /><span>{where(o)}</span></p></div></header>
        {o.note && <p className="note info"><I n="info" /><span>{o.note}</span></p>}
        <Link className="btn primary wide" to={`/map/place/${o.place}?office=${id}&from=office`}><I n="map" /> Show on map</Link>
        {(o.services || []).length > 0 && <section className="stack gap-8"><h2 className="h2">Services</h2>{o.services.map((sid: string) => <ProcCard key={sid} id={sid} pr={W.processes[sid]} />)}</section>}
        {o.reportsTo && <section className="orgbox">
          <button className="org-head" type="button" aria-expanded={S.orgOpen} aria-controls="orgchain" onClick={() => set((d) => { d.orgOpen = !d.orgOpen; })}><span className="grow"><span className="h3">Office reporting structure</span><span className="small">Who the {o.name} reports to</span></span><I n="caret" cls="ico caret" /></button>
          <div className="org-body" id="orgchain" hidden={!S.orgOpen}><ol className="org-chain">{o.reportsTo.map((n: string, i: number, a: string[]) => <li key={n} className={i === a.length - 1 ? "here" : ""}>{n}</li>)}</ol>
            <Ext href={W.links.orgchart} label="View official chart" /></div></section>}
      </div></div>{S.signed && <Tabs on="Directory" />}</section>
  );
}

/* ---------- 27B, 28B, 28C process page: the order to remember, then the checklist ---------- */
const STEP_IC: Record<string, ReactNode> = {
  ticket: <><path d="M4 7h16v4a2 2 0 000 4v2H4v-2a2 2 0 000-4z" /><path d="M14 7v10" strokeDasharray="2 2" /></>,
  door: <><path d="M6 21V4h10v17" /><path d="M3 21h18M13 12h.01" /></>,
  pay: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
};
export function Process() {
  const { id = "" } = useParams(), [p] = useSearchParams(), { S, set } = useWF();
  const pr = W.processes[id]; if (!pr) return <Directory />;
  const o = W.offices[pr.office], done = procDone(S, id), reading = +(p.get("step") || 0), n = pr.steps.length, stops = procStops(pr), nextStep = nextOf(pr, done);
  const toggle = (k: number) => set((d) => { const a = d.procDone[id] = d.procDone[id] || []; const i = a.indexOf(k); if (i >= 0) a.splice(i, 1); else a.push(k); });
  const stepMap = (st: any, k: number) => `/map/place/${st.place}?${st.office ? `office=${st.office}&` : ""}from=process&pid=${id}&step=${k}&settled=1`;
  const goStep = (k: number) => document.getElementById(`step-${k}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  return (
    <section className={`view${S.signed ? " has-tabs" : ""} proc2`}><Bar title="Process" back={`/directory/office/${pr.office}`} backLabel={o.short || o.name} />
      <div className="scroll proc-scroll" style={{ top: 60 }}><div className="pad stack gap-20" style={{ paddingBottom: 28 }}>
        <header className="stack gap-8"><h1 className="h1">{pr.title}</h1>
          {pr.order ? <p className="of-where"><I n="pin" /><span>{o.name}, {where(o)}</span></p> : <p className="body">{pr.intro}</p>}
          {pr.sample && <p className="sample-note"><I n="info" /><span>Sample steps for the prototype. Confirm the order with {o.short || o.name}.</span></p>}</header>
        <section className="progress-card"><div className="row" style={{ justifyContent: "space-between" }}><p className="h3">{done.length === n ? "All steps done" : `${done.length} of ${n} steps done`}</p>{nextStep && <button className="nc-link" type="button" onClick={() => goStep(nextStep)}>Next: step {nextStep}</button>}</div>
          <ProgressBar done={done.length} total={n} label={`${done.length} of ${n} steps done`} /></section>
        {pr.order ? (
          <section className="order" aria-label="Start online. On campus, visit Registrar, then Cashier, then Registrar.">
            <p className="order-line">Start online. On campus, visit Registrar → Cashier → Registrar.</p>
            <ol className="order-path">{pr.order.map(([l, k]: string[], i: number) => <li key={i} className={i === 0 ? "online" : ""}><span className="op-ic"><svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{STEP_IC[k]}</svg></span><span>{l}</span></li>)}</ol></section>
        ) : (
          <section className="walk"><div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}><h2 className="h2">Buildings to walk to</h2><span className="small">{stops.length} stops</span></div>
            <ol className="walk-list">{stops.map((stp, i) => { const pl = W.places[stp.place], stt = stopState(stp, done, nextStep);
              return <li key={i} className={`walk-stop ${stt}`}><span className="ws-n">{stt === "done" ? <I n="check" /> : i + 1}</span><Silhouette shape={pl.shape} size={34} />
                <span className="grow"><span className="h3">{pl.name}</span><span className="small">{stp.offices.length ? [...new Set(stp.offices)].map(shortOf).join(", ") + " · " : ""}step{stp.steps.length > 1 ? "s" : ""} {stp.steps.join(" and ")}</span></span>
                {stt === "now" && <span className="pill gold">Next stop</span>}</li>; })}</ol>
            <Link className="btn primary wide" to={`/map/stops?pid=${id}`}><I n="map" /> Show all stops on map</Link></section>
        )}
        <section><h2 className="h2" style={{ marginBottom: 10 }}>Checklist</h2><ol className="steps">{pr.steps.map((st: any, i: number) => { const k = i + 1, isDone = done.includes(k), pl = st.place && W.places[st.place];
          return (
            <li key={k} className={`step${isDone ? " done" : ""}${reading === k ? " reading" : ""}${k === nextStep ? " next" : ""}`} id={`step-${k}`}>
              <button className="step-n" type="button" aria-pressed={isDone} aria-label={`Mark step ${k} ${isDone ? "not done" : "done"}`} onClick={() => toggle(k)}><span>{k}</span><I n="check" /></button>
              <div className="step-body"><h3 className="h3">{st.title}{st.optional && <> <span className="tag sm">If needed</span></>}</h3>
                {pl && !pr.order && <p className="step-where"><Silhouette shape={pl.shape} size={18} /><span>{st.office ? `${shortOf(st.office)}, ` : ""}{pl.name}</span></p>}
                <p className="body">{st.body}</p>
                {st.fields && <ul className="step-fields">{st.fields.map((f: string) => <li key={f}>{f}</li>)}</ul>}
                {st.action === "ticketon" && <Ext href={W.links.ticketon} label="Open WVSU Ticketon" cls="btn primary step-btn" />}
                {st.action === "map" && <Link className="btn outline step-btn" to={stepMap(st, k)}><I n="map" /> Show Registrar on map</Link>}
                {pl && !st.action && !pr.order && <Link className="link step-link" to={stepMap(st, k)}><I n="map" /> Show on map</Link>}
              </div></li>);
        })}</ol></section>
        {pr.order && <><Ext href={W.links.charter} label="View official requirements" cls="btn ghost wide" />
          <p className="small" style={{ textAlign: "center" }}>Fees and processing times are in the official requirements (WVSU Citizen’s Charter).</p></>}
      </div></div>{S.signed && <Tabs on="Directory" />}</section>
  );
}

/* ---------- 31–32 Ask WayFinder: a sheet over the screen you were on ---------- */
const Q1 = "Where is my Wednesday CIT 213 class?";
function answerFor(S: State, q: string) {
  const s = S.saved;
  if (!s) return { text: "I can answer that once your timetable is saved.", actions: [["Scan timetable", "/scan", "primary"]], src: "", rich: false };
  if (/registrar/i.test(q)) return { text: "The Registrar’s Office is on Floor 1 of the Administration Building.", actions: [["Show on map", "/map/place/administration?office=registrar&from=ask", "primary"], ["Open in Directory", "/directory/office/registrar", "outline"]], src: "From the campus directory", rich: false };
  if (/monday/i.test(q)) { const items: string[] = []; s.forEach((x) => x.m.forEach((m) => { if (m[0] === 1) items.push(`${x.code} · ${range(m[1], m[2])} · ${m[3]}`); })); const rooms = [...new Set(s.flatMap((x) => x.m.filter((m) => m[0] === 1).map((m) => m[3])))];
    return { text: `On Monday you’re in ${rooms.slice(0, -1).join(", ")}${rooms.length > 1 ? " and " : ""}${rooms[rooms.length - 1]}:\n${items.join("\n")}`, actions: [["Open Monday", "/schedule?view=week&day=1", "primary"]], src: "From your saved schedule", rich: false }; }
  const cit = s.find((x) => x.code === "CIT 213") || s[1], m = cit.m[1] || cit.m[0];
  const rr = W.places["cict-building"].rooms[m[3]], fl = rr && rr.confirmed ? rr.floor : null;
  return { text: `Your Wednesday CIT 213 class is ${range(m[1], m[2])} in ${m[3]}, CICT Building.\n${fl ? `${m[3]} is on Floor ${fl}. The map opens Floor ${fl} with the room outlined.` : `The building is confirmed, but ${m[3]}’s exact spot isn’t mapped yet, so the map opens on the CICT Building.`}`, rich: true,
    actions: [["Open CICT Building on map", `/map/place/cict-building?room=${enc(m[3])}&from=ask`, "primary"], ["View Wednesday meeting", "/class/CIT%20213/1", "outline"]], src: "From your saved schedule · CIT 213, Wednesday", time: range(m[1], m[2]), room: m[3] };
}
export function AskSheet({ answer = false, under }: { answer?: boolean; under: ReactNode }) {
  const { S, set } = useWF(), nav = useNavigate(), loc = useLocation();
  const back = (loc.state as { back?: string } | null)?.back || "/home";
  const ask = (q: string) => { set((d) => { d.ask.push(q); }); nav("/ask/answer", { state: { back } }); };
  const q = S.ask[S.ask.length - 1] || Q1, a = answer ? answerFor(S, q) : null;
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("q") || "").trim(); if (v) ask(v); };
  return (
    <>
      {under}
      <Link className="scrim ask-scrim" to={back} aria-label="Close" />
      <div className="sheet ask-sheet" role="dialog" aria-modal="true" aria-label="Ask WayFinder">
        {!answer ? <>
          <div className="ask-head"><span className="ask-badge"><I n="ask" /></span><h2 className="h2" style={{ flex: 1 }}>Ask WayFinder</h2><Link className="icon-btn" to={back} aria-label="Close"><I n="x" /></Link></div>
          <p className="small" style={{ margin: "2px 0 14px" }}>Answers come from your saved schedule and the campus records.</p>
          <div className="ask-list">{[Q1, "Which rooms do I use on Monday?", "Where is the Registrar?"].map((x) => <button key={x} className="ask-q" onClick={() => ask(x)}><span>{x}</span><I n="arrow" /></button>)}</div>
          <form className="field ask-field" onSubmit={submit}><input name="q" placeholder="Ask where a class or office is" aria-label="Ask WayFinder" /><button className="icon-btn" type="submit" aria-label="Send"><I n="arrow" /></button></form>
        </> : <>
          <div className="ask-head"><Link className="back" to="/ask" state={{ back }}><I n="back" /><span>Questions</span></Link><span style={{ flex: 1 }} /><Link className="icon-btn" to={back} aria-label="Close"><I n="x" /></Link></div>
          <div className="stack gap-12">
            <p className="bubble me">{q}</p>
            <article className="answer stack gap-12">
              {a!.src && <p className="answer src"><Needle size={16} /> {a!.src}</p>}
              {a!.rich && <div className="tiles2" style={{ gridTemplateColumns: "1fr 1fr" }}><div className="vtile" style={{ padding: "12px 14px" }}><p className="label">Wednesday</p><p className="h2" style={{ marginTop: 6, fontSize: 18, whiteSpace: "nowrap" }}>{(a as any).time}</p></div><div className="vtile" style={{ padding: "12px 14px", background: "var(--gold-soft)", borderColor: "var(--gold-line)" }}><p className="label">Room</p><p className="room" style={{ marginTop: 4, fontSize: 28, whiteSpace: "nowrap" }}>{(a as any).room}</p></div></div>}
              <p className="body" style={{ whiteSpace: "pre-line" }}>{a!.text}</p>
              {a!.actions.map(([l, h, k]) => <Link key={l} className={`btn ${k} wide`} to={h} state={h.startsWith("/class") ? { from: "answer" } : undefined}>{k === "primary" && <I n="map" />}{l}</Link>)}
            </article>
            <Link className="link" to="/ask" state={{ back }} style={{ alignSelf: "center" }}>Ask something else</Link></div>
        </>}
      </div>
    </>
  );
}
