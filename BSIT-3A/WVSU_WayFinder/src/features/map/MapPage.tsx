import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "maplibre-gl/dist/maplibre-gl.css";
import LoadError from "../../components/LoadError";
import Notice from "../../components/Notice";
import SearchBar from "../../components/SearchBar";
import { DataBadge } from "../../components/PlaceCard";
import { PinIcon, RouteIcon } from "../../components/Icons";
import { getCampusPaths, getPlace, listPlaces } from "../../lib/data";
import { accuracyLabel, CAMPUS_CENTER, CAMPUS_RADIUS_M, failureText, getLocation, type Fix, type LocationFailure } from "../../lib/location";
import { distanceM, entrancesOf, routeBetween, snapToNode } from "../../lib/routing/graph";
import type { PlaceView } from "../../lib/types";
import { useAsync } from "../../lib/usePlaces";
import StartPicker from "./StartPicker";
import { hasMapTiler, useMapLibre, type Pin } from "./useMapLibre";

/** A room or office is reached through its building; a building is its own destination. */
const buildingOf = (v: PlaceView | null | undefined) => (v ? (v.place.kind === "building" ? v.place : v.parent) : undefined);
const pointOf = (v: PlaceView) => (v.place.lng !== undefined ? v.place : v.parent?.lng !== undefined ? v.parent : undefined);

export default function MapPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const to = params.get("to") ?? params.get("place") ?? "";
  const from = params.get("from") ?? "";

  const dest = useAsync(`dest:${to}`, async () => (to ? getPlace(to) : { data: null, mode: "live" as const }));
  const paths = useAsync("paths", getCampusPaths);
  const all = useAsync("all-places", listPlaces);
  const start = useAsync(`start:${from}`, async () => (from && from !== "gps" ? getPlace(from) : { data: null, mode: "live" as const }));

  const [fix, setFix] = useState<Fix | null>(null);
  const [locFail, setLocFail] = useState<LocationFailure | null>(null);
  const [locating, setLocating] = useState(false);
  const [picker, setPicker] = useState(false);

  // Destination is kept in the URL; changing the start only rewrites `from`.
  const setFrom = (f: string) => {
    const next = new URLSearchParams(params);
    next.delete("place");
    if (to) next.set("to", to);
    if (f) next.set("from", f); else next.delete("from");
    navigate(`/map?${next.toString()}`, { replace: true });
  };

  // Each GPS request gets an id. Picking a start by hand, or leaving the screen, bumps the id so a
  // late GPS result is ignored and never replaces the student's manual choice.
  const locRequest = useRef(0);
  useEffect(() => () => { locRequest.current++; }, []);

  async function useMyLocation() {
    const id = ++locRequest.current;
    setLocating(true);
    const out = await getLocation();
    if (id !== locRequest.current) return;
    setLocating(false);
    if (out.ok) { setFix(out.fix); setLocFail(null); setFrom("gps"); }
    else { setFix(null); setLocFail(out.reason); }
  }

  const destView = dest.state === "done" ? dest.result.data : null;
  const startView = start.state === "done" ? start.result.data : null;
  const campus = paths.state === "done" ? paths.result.data : null;
  const places = all.state === "done" ? all.result.data : [];
  const destBuilding = buildingOf(destView);
  const destPoint = destView ? pointOf(destView) : undefined;

  const gpsPoor = fix ? fix.accuracy > 50 : false;
  const offCampus = fix ? distanceM(fix, CAMPUS_CENTER) > CAMPUS_RADIUS_M : false;
  const gpsNode = fix && campus && !gpsPoor && !offCampus ? snapToNode(campus, fix) : null;

  const plan = useMemo(() => {
    if (!campus || !destBuilding) return null;
    if (from === "gps" && gpsNode) return routeBetween(campus, { nodeId: gpsNode.node.id }, destBuilding.id);
    const sb = buildingOf(startView);
    if (from && from !== "gps" && sb) return routeBetween(campus, { buildingId: sb.id }, destBuilding.id);
    return null;
  }, [campus, destBuilding, from, gpsNode, startView]);

  const routeProblem = (() => {
    if (!to) return null;
    if (!destBuilding) return "This place isn’t linked to a building with a recorded location yet, so no walking route can be drawn.";
    if (!campus) return null;
    if (!entrancesOf(campus, destBuilding.id).length) return `No verified entrance is recorded for ${destBuilding.name} yet.`;
    if (!from) return "Choose where you’re starting from to get walking directions.";
    if (from === "gps" && !fix) return "Tap “Use my location” again, or choose a starting point.";
    if (from === "gps" && (gpsPoor || offCampus)) return null; // explained by the location notice
    if (from === "gps" && !gpsNode) return "You’re not near a verified walkway. Choose a starting building or room instead.";
    if (from !== "gps" && startView && buildingOf(startView)?.id === destBuilding.id) return "You’re already in this building.";
    if (!plan) return "No verified walking route connects these places yet.";
    return null;
  })();

  const floorPlans = campus && destBuilding && destView?.place.floor !== undefined
    ? campus.floorPlans.filter((f) => f.buildingId === destBuilding.id && f.floor === destView.place.floor)
    : [];

  const pins: Pin[] = useMemo(() => {
    const out: Pin[] = [];
    for (const v of places) {
      if (v.place.kind === "building" && v.place.lng !== undefined && v.place.lat !== undefined && v.place.id !== destBuilding?.id) {
        out.push({ id: v.place.id, lng: v.place.lng, lat: v.place.lat, kind: "building", title: v.place.name, onClick: () => navigate(`/map?to=${v.place.id}${from ? `&from=${from}` : ""}`) });
      }
    }
    if (campus && destBuilding) for (const e of entrancesOf(campus, destBuilding.id)) out.push({ id: e.id, lng: e.lng, lat: e.lat, kind: "entrance", title: e.name });
    if (destPoint?.lng !== undefined && destPoint.lat !== undefined) out.push({ id: "dest", lng: destPoint.lng, lat: destPoint.lat, kind: "dest", title: `Destination: ${destBuilding?.name ?? destView?.place.name}` });
    if (from === "gps" && fix) out.push({ id: "start", lng: fix.lng, lat: fix.lat, kind: "here", title: "You are here" });
    else {
      const sp = startView ? pointOf(startView) : undefined;
      if (sp?.lng !== undefined && sp.lat !== undefined) out.push({ id: "start", lng: sp.lng, lat: sp.lat, kind: "start", title: "Start" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, campus, destBuilding?.id, destPoint?.lng, destPoint?.lat, from, fix, startView]);

  const container = useRef<HTMLDivElement>(null);
  const { basemapFailed, mapError } = useMapLibre(container, pins, plan?.route.coords ?? null);
  const demo = [dest, paths, all].some((r) => r.state === "done" && r.result.mode === "demo");
  const isRoomLike = destView && destView.place.kind !== "building";

  return (
    <section className="map-page">
      <h1 className="page-title">Campus Map</h1>
      <SearchBar />
      {demo && <Notice>Supabase is not configured. Showing DEMO places and walkways, not official WVSU information.</Notice>}
      {basemapFailed && !mapError && <Notice tone="info">{hasMapTiler ? "MapTiler basemap unavailable." : "No MapTiler key set."} Showing the campus overlay only.</Notice>}
      {mapError && <Notice>{mapError}</Notice>}

      <div className="map-layout">
        <div className="map-wrap"><div ref={container} className="map" data-testid="map" /></div>

        <div className="map-panel">
          {dest.state === "error" && <LoadError what="this destination" onRetry={dest.reload} />}
          {paths.state === "error" && <LoadError what="walking paths" onRetry={paths.reload} />}
          {to && dest.state === "done" && !destView && <div className="card empty"><h2>Place not found</h2><p className="muted">No place has the ID “{to}”.</p></div>}
          {!to && (
            <article className="card" aria-label="My location">
              <p className="muted">Search for a room or building, or tap a building on the map, to get directions.</p>
              {from === "gps" && fix && <p className="start-line">You are here · accuracy ±{Math.round(fix.accuracy)} m <span className={`badge acc-${accuracyLabel(fix.accuracy).toLowerCase()}`}>{accuracyLabel(fix.accuracy)}</span></p>}
              {locFail && <Notice>{failureText[locFail]}</Notice>}
              {fix && offCampus && !gpsPoor && <Notice>You appear to be outside the campus.</Notice>}
              <div className="actions">
                <button className="btn primary" onClick={useMyLocation} disabled={locating}>{locating ? "Locating…" : "Use my location"}</button>
              </div>
            </article>
          )}

          {destView && (
            <article className="card dest-card" aria-label="Destination">
              <div className="card-head"><span className="kind"><PinIcon /> Destination</span><DataBadge status={destView.place.status} /></div>
              <h2 className="place-name">{destBuilding?.name ?? destView.place.name}</h2>
              {isRoomLike && destBuilding && <p className="muted small">Walk to this building, then go inside to {destView.place.roomCode ?? destView.place.name}.</p>}
              {plan && <p className="muted small">Enter at: <strong>{plan.entrance.name}</strong></p>}
              {!destPoint && <p className="tbc">Location unconfirmed</p>}
            </article>
          )}

          {destView && isRoomLike && (
            <article className="card inside-card" aria-label="Inside the building">
              <div className="card-head"><span className="kind">Inside the building</span></div>
              <dl className="facts">
                {destView.place.roomCode && <div><dt>Room</dt><dd className="room-code small-code">{destView.place.roomCode}</dd></div>}
                {destView.place.kind !== "room" && <div><dt>Office</dt><dd>{destView.place.name}</dd></div>}
                <div><dt>Floor</dt><dd>{destView.place.floor ?? "Not recorded"}</dd></div>
              </dl>
              {floorPlans.map((f) => (
                <figure key={f.id} className="floorplan">
                  <img src={f.imageUrl} alt={f.label ?? `Floor ${f.floor} plan`} />
                  <figcaption className="muted small">{f.label ?? `Floor ${f.floor}`}</figcaption>
                </figure>
              ))}
              {campus && floorPlans.length === 0 && <p className="muted small">No floor plan is available for this floor.</p>}
            </article>
          )}

          {to && destView && (
            <article className="card route-card" aria-label="Directions">
              <div className="card-head"><span className="kind"><RouteIcon /> Walking route</span></div>
              {plan ? (
                <p className="route-summary"><strong>{plan.route.minutes} min</strong> walk · {Math.round(plan.route.meters)} m <span className="muted small">(≈ estimate at 1.2 m/s, verified walkways only)</span></p>
              ) : routeProblem ? <p className="muted">{routeProblem}</p> : paths.state === "loading" ? <p className="muted">Loading walkways…</p> : null}

              <h3 className="sub-label">Starting from</h3>
              <p className="start-line">
                {from === "gps" && fix ? <>You are here · accuracy ±{Math.round(fix.accuracy)} m <span className={`badge acc-${accuracyLabel(fix.accuracy).toLowerCase()}`}>{accuracyLabel(fix.accuracy)}</span></>
                  : startView ? <><strong>{startView.place.roomCode ?? startView.place.name}</strong>{startView.parent ? ` · ${startView.parent.name}` : ""}</>
                  : <span className="muted">Not set</span>}
              </p>
              {locFail && <Notice>{failureText[locFail]} Choose a starting building or room instead.</Notice>}
              {fix && gpsPoor && <Notice>GPS accuracy is poor (±{Math.round(fix.accuracy)} m). Choose a starting building or room for reliable directions.</Notice>}
              {fix && offCampus && !gpsPoor && <Notice>You appear to be outside the campus. Choose a starting building or room.</Notice>}
              <div className="actions">
                <button className="btn primary" onClick={useMyLocation} disabled={locating}>{locating ? "Locating…" : "Use my location"}</button>
                <button className="btn ghost" onClick={() => setPicker(true)}>Choose starting point</button>
              </div>
            </article>
          )}

          {destView && <Link className="inline-link small" to={`/directory/${destView.place.id}`}>Place details</Link>}
        </div>
      </div>

      {picker && <StartPicker places={places} onClose={() => setPicker(false)} onPick={(id) => { locRequest.current++; setPicker(false); setLocating(false); setFix(null); setLocFail(null); setFrom(id); }} />}
    </section>
  );
}
