import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "maplibre-gl/dist/maplibre-gl.css";
import LoadError from "../../components/LoadError";
import Notice from "../../components/Notice";
import SearchBar from "../../components/SearchBar";
import { DataBadge } from "../../components/PlaceCard";
import { PinIcon, RouteIcon } from "../../components/Icons";
import { getBuilding, getCampusPaths, getPlace, listPlaces } from "../../lib/data";
import { accuracyLabel, CAMPUS_CENTER, CAMPUS_RADIUS_M, failureText, getLocation, type Fix, type LocationFailure } from "../../lib/location";
import { distanceM, entrancesOf } from "../../lib/routing/graph";
import { prefixPointer } from "../../lib/campus/resolve";
import { roomDisplay } from "../../lib/search";
import { planTrip, POOR_ACCURACY_M, type TripDest, type TripStart } from "../../lib/trip/plan";
import type { BuildingRef, PlaceView } from "../../lib/types";
import { useAsync } from "../../lib/usePlaces";
import BuildingCard from "./BuildingCard";
import { campusBuildingsOnce, findBuilding, type Building } from "./buildings";
import FloorPlanViewer from "./FloorPlanViewer";
import PlanImage from "./PlanImage";
import StartPicker from "./StartPicker";
import { useMediaQuery } from "./useMediaQuery";
import { hasMapTiler, useMapLibre, type Pin } from "./useMapLibre";

const pointOf = (v: PlaceView) => (v.place.lng !== undefined ? v.place : v.parent?.lng !== undefined ? v.parent : undefined);
/** `map:<polygon id>` (or `map:f:<feature>`) = a building drawn on the campus map rather than a record ID. */
const isMapKey = (id: string) => id.startsWith("map:");
const centerOf = (b: Building) => ({ lng: (b.bbox[0] + b.bbox[2]) / 2, lat: (b.bbox[1] + b.bbox[3]) / 2 });

export default function MapPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const to = params.get("to") ?? params.get("place") ?? "";
  const from = params.get("from") ?? "";
  // The building whose card is open: `map:<polygon id>` (tapped on the map) or `place:<place id>` (a pin).
  // Separate from `to`: tapping a building never changes the route until the student taps Directions.
  const sel = params.get("sel") ?? "";

  // A room code typed in search whose room isn't confirmed (only its prefix is known).
  const code = params.get("code") ?? "";
  const none = { data: null, mode: "live" as const };

  // Building polygons from the live MapTiler dataset (shared with search): `map:` destinations/starts.
  const shapes = useAsync("campus-buildings", async () => ({ data: await campusBuildingsOnce(), mode: "live" as const }));
  const shapeList = shapes.state === "done" ? shapes.result.data : [];
  const destShape = isMapKey(to) ? findBuilding(shapeList, to) : undefined;
  const startShape = isMapKey(from) ? findBuilding(shapeList, from) : undefined;
  // A polygon's linked building record (if any) is what routes and entrances hang off.
  const destLink = useAsync(`link:${destShape?.key ?? ""}`, async () => (destShape ? getBuilding({ featureIds: destShape.featureIds }) : none));
  const startLink = useAsync(`link:${startShape?.key ?? ""}`, async () => (startShape ? getBuilding({ featureIds: startShape.featureIds }) : none));

  const dest = useAsync(`dest:${to}`, async () => (to && !isMapKey(to) ? getPlace(to) : none));
  const paths = useAsync("paths", getCampusPaths);
  const all = useAsync("all-places", listPlaces);
  const start = useAsync(`start:${from}`, async () => (from && from !== "gps" && !isMapKey(from) ? getPlace(from) : none));

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
  /** Open, switch or close the building card. Keeps `to` and `from` exactly as they are. */
  const setSel = (key: string) => {
    const next = new URLSearchParams(params);
    if (key) next.set("sel", key); else next.delete("sel");
    navigate(`/map?${next.toString()}`, { replace: true });
  };
  /** Directions: the selected building becomes the destination; the start is preserved. */
  const directionsTo = (placeId: string) => {
    const next = new URLSearchParams();
    next.set("to", placeId);
    if (from) next.set("from", from);
    navigate(`/map?${next.toString()}`);
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

  const linkedDest = destLink.state === "done" ? destLink.result.data : null;
  const linkedStart = startLink.state === "done" ? startLink.result.data : null;
  const destView: PlaceView | null = destShape ? (linkedDest ? { place: linkedDest.place } : null) : dest.state === "done" ? dest.result.data : null;
  const startView: PlaceView | null = startShape ? (linkedStart ? { place: linkedStart.place } : null) : start.state === "done" ? start.result.data : null;
  /** A map building with no linked record: still a visible destination, but nothing to route to. */
  const destMappedOnly = destShape && destLink.state === "done" && !linkedDest ? destShape : undefined;
  const startMappedOnly = startShape && startLink.state === "done" && !linkedStart ? startShape : undefined;
  const campus = paths.state === "done" ? paths.result.data : null;
  const places = all.state === "done" ? all.result.data : [];
  const destPoint = destView ? pointOf(destView) : destShape ? centerOf(destShape) : undefined;
  const codePointer = code && destShape ? prefixPointer(code, shapeList) : null;

  const gpsPoor = fix ? fix.accuracy > POOR_ACCURACY_M : false;
  const offCampus = fix ? distanceM(fix, CAMPUS_CENTER) > CAMPUS_RADIUS_M : false;

  const tripDest: TripDest | null = destView ? { kind: "place", view: destView } : destMappedOnly ? { kind: "mapped", name: destMappedOnly.name } : null;
  const tripStart: TripStart = from === "gps" ? { kind: "gps", fix, failure: locFail ?? undefined }
    : startView ? { kind: "place", view: startView }
    : startMappedOnly ? { kind: "mapped", name: startMappedOnly.name }
    : { kind: "none" };
  const trip = useMemo(() => (tripDest ? planTrip(tripDest, tripStart, campus) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripDest?.kind === "place" ? tripDest.view.place.id : tripDest?.name, from, fix, locFail, startView?.place.id, startMappedOnly?.key, campus]);
  const destBuilding = trip?.destBuilding;
  const plan = trip?.route && trip.entrance ? { route: trip.route, entrance: trip.entrance } : null;
  const routeProblem = trip && !plan ? trip.message ?? null : null;
  const indoor = trip?.indoor;
  const destName = destBuilding?.name ?? destView?.place.name ?? destShape?.name;
  const [planOpen, setPlanOpen] = useState(false);
  useEffect(() => setPlanOpen(false), [to]);

  const pins: Pin[] = useMemo(() => {
    const out: Pin[] = [];
    for (const v of places) {
      if (v.place.kind === "building" && v.place.lng !== undefined && v.place.lat !== undefined && v.place.id !== destBuilding?.id) {
        out.push({ id: v.place.id, lng: v.place.lng, lat: v.place.lat, kind: "building", title: v.place.name, onClick: () => setSelRef.current(`place:${v.place.id}`) });
      }
    }
    if (campus && destBuilding) for (const e of entrancesOf(campus, destBuilding.id)) out.push({ id: e.id, lng: e.lng, lat: e.lat, kind: "entrance", title: e.name });
    if (destPoint?.lng !== undefined && destPoint.lat !== undefined) out.push({ id: "dest", lng: destPoint.lng, lat: destPoint.lat, kind: "dest", title: `Destination: ${destName}` });
    if (from === "gps" && fix) out.push({ id: "start", lng: fix.lng, lat: fix.lat, kind: "here", title: "You are here" });
    else {
      const sp = startView ? pointOf(startView) : undefined;
      if (sp?.lng !== undefined && sp.lat !== undefined) out.push({ id: "start", lng: sp.lng, lat: sp.lat, kind: "start", title: "Start" });
      else if (startShape) out.push({ id: "start", ...centerOf(startShape), kind: "start", title: "Start" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, campus, destBuilding?.id, destPoint?.lng, destPoint?.lat, destName, from, fix, startView, startShape?.key]);

  const setSelRef = useRef(setSel);
  setSelRef.current = setSel;

  // ---- Building card ------------------------------------------------------------------------
  const wide = useMediaQuery("(min-width: 1024px)");
  const [expanded, setExpanded] = useState(false);
  const selFeatureId = sel.startsWith("map:") && /^\d+$/.test(sel.slice(4)) ? Number(sel.slice(4)) : undefined;
  const selPlaceId = sel.startsWith("place:") ? sel.slice(6) : undefined;
  // The map hook reports the parsed polygons after the style loads (it needs the highlight we derive here).
  const [mapBuildings, setMapBuildings] = useState<Building[]>([]);
  const tapped = findBuilding(mapBuildings, sel);
  const ref: BuildingRef | null = selPlaceId ? { placeId: selPlaceId }
    : tapped ? { featureIds: tapped.featureIds }
    : selFeatureId !== undefined ? { featureIds: [selFeatureId] } : null;
  const building = useAsync(`building:${sel}:${ref && "featureIds" in ref ? ref.featureIds.join(",") : ""}`,
    async () => (ref ? getBuilding(ref) : { data: null, mode: "live" as const }));
  const buildingInfo = building.state === "done" ? building.result.data : null;
  const pinPlace = selPlaceId ? places.find((v) => v.place.id === selPlaceId)?.place : undefined;
  // For a pin, highlight the polygons linked to its record; for a tap, the tapped building.
  const linkedPolys = selPlaceId && buildingInfo ? mapBuildings.filter((b) => b.featureIds.some((id) => buildingInfo.featureIds.includes(id))) : [];
  const selBuilding = tapped ?? linkedPolys[0];
  const highlight = tapped ? tapped.rawNames : linkedPolys.flatMap((b) => b.rawNames);
  const cardName = tapped?.name ?? pinPlace?.name ?? buildingInfo?.place.name ?? (selFeatureId !== undefined ? "Campus building" : "");
  useEffect(() => setExpanded(false), [sel]);

  const container = useRef<HTMLDivElement>(null);
  const { basemapFailed, mapError, buildings, reveal } = useMapLibre(container, pins, plan?.route.coords ?? null, {
    highlight,
    onBuildingTap: (b) => setSelRef.current(b.key),
  });
  useEffect(() => setMapBuildings(buildings), [buildings]);

  // Keep the selected building visible above the phone sheet (desktop: the card sits beside the map).
  const sheetRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!selBuilding || !container.current) return;
    const map = container.current.getBoundingClientRect();
    const sheet = !wide ? sheetRef.current?.getBoundingClientRect() : undefined;
    const bottom = sheet ? Math.max(0, map.bottom - sheet.top) : 0;
    reveal(selBuilding, { bottom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selBuilding?.key, expanded, wide]);

  const card = sel && cardName ? (
    <BuildingCard
      name={cardName}
      details={building}
      variant={wide ? "side" : "sheet"}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onClose={() => setSel("")}
      onDirections={directionsTo}
    />
  ) : null;
  const demo = [dest, paths, all].some((r) => r.state === "done" && r.result.mode === "demo");
  const destStatus = destView?.place.status;
  const waitingForShape = isMapKey(to) && (shapes.state === "loading" || (destShape && destLink.state === "loading"));

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
          {wide && card}
          {dest.state === "error" && <LoadError what="this destination" onRetry={dest.reload} />}
          {paths.state === "error" && <LoadError what="walking paths" onRetry={paths.reload} />}
          {to && !isMapKey(to) && dest.state === "done" && !destView && <div className="card empty"><h2>Place not found</h2><p className="muted">No place has the ID “{to}”.</p></div>}
          {isMapKey(to) && !waitingForShape && !destShape && <div className="card empty"><h2>Building not found</h2><p className="muted">That building isn’t on the campus map right now.</p></div>}
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

          {(destView || destMappedOnly) && (
            <article className="card dest-card" aria-label="Destination">
              <div className="card-head"><span className="kind"><PinIcon /> Destination</span>{destStatus ? <DataBadge status={destStatus} /> : <span className="badge unverified">Map only</span>}</div>
              <h2 className="place-name">{destName}</h2>
              {codePointer && "message" in codePointer && <p className="tbc" role="status">{codePointer.message}</p>}
              {indoor && destBuilding && <p className="muted small">Walk to this building, then go inside to {indoor.label}.</p>}
              {plan && <p className="muted small">Enter at: <strong>{plan.entrance.name}</strong></p>}
              {!destPoint && <p className="tbc">Location unconfirmed</p>}
            </article>
          )}

          {destView && indoor && (
            <article className="card inside-card" aria-label="Inside the building">
              <div className="card-head"><span className="kind">Inside the building</span>{trip?.status === "same-building" && <span className="pill">Indoor step</span>}</div>
              <dl className="facts">
                {destView.place.kind === "room" && <div><dt>Room</dt><dd className="room-code small-code">{roomDisplay(destView.place)}</dd></div>}
                {destView.place.kind !== "room" && <div><dt>Office</dt><dd>{destView.place.name}</dd></div>}
                <div><dt>Floor</dt><dd>{indoor.floor ?? "Not recorded"}</dd></div>
              </dl>
              {indoor.plan && (
                <figure className="floorplan">
                  <PlanImage plan={indoor.plan} spot={indoor.spot} alt={indoor.plan.label ?? `Floor ${indoor.plan.floor} plan`} />
                  <figcaption className="muted small">{indoor.plan.label ?? `Floor ${indoor.plan.floor}`}{indoor.spot ? ` · ${indoor.spot.label} highlighted` : ""}</figcaption>
                  <button className="btn ghost wide" onClick={() => setPlanOpen(true)}>Open floor plan</button>
                </figure>
              )}
              {indoor.note && (campus || !indoor.plans.length) && <p className="muted small indoor-note">{indoor.note}</p>}
            </article>
          )}

          {to && (destView || destMappedOnly) && (
            <article className="card route-card" aria-label="Directions">
              <div className="card-head"><span className="kind"><RouteIcon /> Walking route</span></div>
              {plan ? (
                <p className="route-summary"><strong>{plan.route.minutes} min</strong> walk · {Math.round(plan.route.meters)} m <span className="muted small">(≈ estimate at 1.2 m/s, verified walkways only)</span></p>
              ) : routeProblem ? <p className="muted">{routeProblem}</p> : paths.state === "loading" ? <p className="muted">Loading walkways…</p> : null}

              <h3 className="sub-label">Starting from</h3>
              <p className="start-line">
                {from === "gps" && fix ? <>You are here · accuracy ±{Math.round(fix.accuracy)} m <span className={`badge acc-${accuracyLabel(fix.accuracy).toLowerCase()}`}>{accuracyLabel(fix.accuracy)}</span></>
                  : startView ? <><strong>{startView.place.kind === "room" ? roomDisplay(startView.place) : startView.place.name}</strong>{startView.parent ? ` · ${startView.parent.name}` : ""}</>
                  : startMappedOnly ? <><strong>{startMappedOnly.name}</strong> <span className="muted small">(map only)</span></>
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

          {destView && !destShape && <Link className="inline-link small" to={`/directory/${destView.place.id}`}>Place details</Link>}
        </div>
      </div>

      {!wide && card && <div className="bsheet-dock" ref={sheetRef}>{card}</div>}

      {planOpen && indoor?.plan && destBuilding && (
        <FloorPlanViewer plans={indoor.plans} building={destBuilding.name} highlight={indoor.spot} onClose={() => setPlanOpen(false)} />
      )}
      {picker && <StartPicker places={places} mapBuildings={shapeList} onClose={() => setPicker(false)} onPick={(id) => { locRequest.current++; setPicker(false); setLocating(false); setFix(null); setLocFail(null); setFrom(id); }} />}
    </section>
  );
}
