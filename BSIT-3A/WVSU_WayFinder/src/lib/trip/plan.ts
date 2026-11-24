// One trip: where the student starts, where they're going, the walking route to the destination
// building's verified entrance, then the indoor step (floor, blueprint, highlighted room).
// Pure and shared by the Map page and the trip fixtures; the Flutter app mirrors it in core/trip.dart.
import { CAMPUS_CENTER, CAMPUS_RADIUS_M, type Fix, type LocationFailure } from "../location";
import { distanceM, entrancesOf, routeBetween, snapToNode, type Route } from "../routing/graph";
import { roomDisplay } from "../search";
import type { CampusPaths, Entrance, FloorPlan, Place, PlaceView, RoomSpot } from "../types";

export const POOR_ACCURACY_M = 50;

export type TripStart =
  | { kind: "none" }
  /** A building, room or office record. */
  | { kind: "place"; view: PlaceView }
  /** A building drawn on the map that has no linked record (so no entrance can be known). */
  | { kind: "mapped"; name: string }
  /**
   * "Use my location": the fix, or why there isn't one (null + no failure = still locating).
   * insideBuildingId: the building record whose map outline contains the fix (a polygon test, not a walkway).
   * nearby: every drawn outline the accuracy circle reaches, with its linked record id if any.
   */
  | { kind: "gps"; fix: Fix | null; failure?: LocationFailure; insideBuildingId?: string; nearby?: NearBuilding[] };

export interface NearBuilding { name: string; placeId?: string }

export type TripDest =
  | { kind: "place"; view: PlaceView }
  | { kind: "mapped"; name: string };

export type TripStatus =
  | "route" | "same-building" | "needs-start" | "no-building" | "no-entrance" | "no-path" | "start-no-entrance"
  | "gps-locating" | "gps-failed" | "gps-poor" | "gps-off-campus" | "gps-off-walkway" | "gps-confirm";

/** A place the student can say they're at instead of the destination (it has a record to start from). */
export interface ArrivalChoice { placeId: string; name: string }

/**
 * Whether a usable GPS fix that reaches `destId` also reaches any other outline (null = not ambiguous).
 * `choices`: the other places with a record, which the student can pick (and the question names).
 * An outline with no record (e.g. Wellness Park, an open park) still makes it ambiguous but is not
 * named: the student reaches it through "Somewhere else", where every campus-map place is listed.
 */
export function gpsAlternatives(start: TripStart, destId: string): { choices: ArrivalChoice[] } | null {
  if (start.kind !== "gps" || start.failure || !start.fix || start.fix.accuracy > POOR_ACCURACY_M) return null;
  const near = start.nearby ?? [];
  if (start.insideBuildingId !== destId && !near.some((b) => b.placeId === destId)) return null;
  const others = near.filter((b) => b.placeId !== destId);
  if (!others.length) return null;
  const choices = new Map<string, ArrivalChoice>();
  for (const b of others) if (b.placeId && !choices.has(b.placeId)) choices.set(b.placeId, { placeId: b.placeId, name: b.name });
  return { choices: [...choices.values()] };
}

export interface Indoor {
  /** Door label (or name for an office). */
  label: string;
  /** Only from the record; never guessed from a room number. */
  floor?: number;
  /** Approved blueprints for that floor. */
  plans: FloorPlan[];
  /** The blueprint to open first: the one the room is marked on. */
  plan?: FloorPlan;
  spot?: RoomSpot;
  note?: string;
}

export interface Trip {
  status: TripStatus;
  /** Shown under "Walking route". Unset when a location notice already explains it. */
  message?: string;
  route?: Route;
  entrance?: Entrance;
  destBuilding?: Place;
  startBuilding?: Place;
  /** Rooms and offices only. */
  indoor?: Indoor;
  /** "gps-confirm" only: the places other than the destination the student can pick (the question names exactly these). */
  confirmChoices?: ArrivalChoice[];
}

/** Where a place is reached from outside: a building (or a landmark such as a gate) itself, else its parent building. */
const anchor = (p?: Place) => (p && (p.kind === "building" || p.kind === "landmark") ? p : undefined);
const buildingOf = (v: PlaceView) => anchor(v.place) ?? anchor(v.parent);

export function indoorStep(dest: PlaceView, building: Place | undefined, campus: CampusPaths | null): Indoor | undefined {
  const p = dest.place;
  if (p.kind === "building" || p.kind === "landmark") return undefined;
  const label = p.kind === "room" ? roomDisplay(p) : p.name;
  if (p.floor === undefined) return { label, plans: [], note: "Floor not recorded yet." };
  if (!campus || !building) return { label, floor: p.floor, plans: [] };
  const plans = campus.floorPlans.filter((f) => f.buildingId === building.id && f.floor === p.floor);
  if (!plans.length) return { label, floor: p.floor, plans, note: "No floor plan is available for this floor." };
  const spot = campus.roomSpots.find((s) => s.placeId === p.id && plans.some((f) => f.id === s.floorPlanId));
  const plan = spot ? plans.find((f) => f.id === spot.floorPlanId) : plans[0];
  return { label, floor: p.floor, plans, plan, spot, note: spot ? undefined : `${label} isn’t marked on this floor plan yet.` };
}

export function planTrip(dest: TripDest, start: TripStart, campus: CampusPaths | null): Trip {
  if (dest.kind === "mapped") {
    return { status: "no-building", message: `${dest.name} isn’t linked to a WayFinder building record yet, so no verified entrance or walking route is known.` };
  }
  const destBuilding = buildingOf(dest.view);
  const indoor = indoorStep(dest.view, destBuilding, campus);
  const base = { destBuilding, indoor };
  if (!destBuilding) return { ...base, status: "no-building", message: "This place isn’t linked to a building with a recorded location yet, so no walking route can be drawn." };

  // Same building: skip walking and go straight to the indoor step.
  if (start.kind === "place" && buildingOf(start.view)?.id === destBuilding.id) {
    return { ...base, status: "same-building", startBuilding: destBuilding, message: "You’re already in this building. Go straight to the floor plan." };
  }
  // The accuracy circle reaches the destination AND another outline: ask before skipping the walk.
  const alt = gpsAlternatives(start, destBuilding.id);
  if (start.kind === "gps" && start.fix && alt) {
    const or = alt.choices.length ? alt.choices.map((c) => c.name).join(" or ") : "somewhere nearby";
    return { ...base, status: "gps-confirm", confirmChoices: alt.choices, message: `Your location (±${Math.round(start.fix.accuracy)} m) could be ${destBuilding.name} or ${or}. Are you at ${destBuilding.name}?` };
  }
  // A usable GPS fix inside the destination building's outline: same as starting there.
  if (start.kind === "gps" && !start.failure && start.fix && start.fix.accuracy <= POOR_ACCURACY_M && start.insideBuildingId === destBuilding.id) {
    return { ...base, status: "same-building", startBuilding: destBuilding, message: `You’re at ${destBuilding.name}. Go straight to the floor plan.` };
  }
  if (!campus) return { ...base, status: "needs-start" };
  if (!entrancesOf(campus, destBuilding.id).length) return { ...base, status: "no-entrance", message: `No verified entrance is recorded for ${destBuilding.name} yet, so walking directions are unavailable.` };

  switch (start.kind) {
    case "none": return { ...base, status: "needs-start", message: "Choose where you’re starting from to get walking directions." };
    case "mapped": return { ...base, status: "start-no-entrance", message: `${start.name} isn’t linked to a WayFinder building record yet, so walking directions from it are unavailable. Choose another starting point.` };
    case "gps": {
      if (start.failure) return { ...base, status: "gps-failed" }; // the location notice explains it
      if (!start.fix) return { ...base, status: "gps-locating", message: "Tap “Use my location” again, or choose a starting point." };
      if (start.fix.accuracy > POOR_ACCURACY_M) return { ...base, status: "gps-poor" };
      if (distanceM(start.fix, CAMPUS_CENTER) > CAMPUS_RADIUS_M) return { ...base, status: "gps-off-campus" };
      const node = snapToNode(campus, start.fix);
      if (!node) return { ...base, status: "gps-off-walkway", message: "You’re not near a verified walkway. Choose a starting building or room instead." };
      const r = routeBetween(campus, { nodeId: node.node.id }, destBuilding.id);
      return r ? { ...base, status: "route", route: r.route, entrance: r.entrance } : noPath(base);
    }
    case "place": {
      const sb = buildingOf(start.view);
      if (!sb) return { ...base, status: "start-no-entrance", message: "This starting point isn’t linked to a building yet. Choose another starting point." };
      if (!entrancesOf(campus, sb.id).length) return { ...base, startBuilding: sb, status: "start-no-entrance", message: `No verified entrance is recorded for ${sb.name} yet, so walking directions from it are unavailable.` };
      const r = routeBetween(campus, { buildingId: sb.id }, destBuilding.id);
      return r ? { ...base, startBuilding: sb, status: "route", route: r.route, entrance: r.entrance } : { ...noPath(base), startBuilding: sb };
    }
  }
}

const noPath = (base: Pick<Trip, "destBuilding" | "indoor">): Trip =>
  ({ ...base, status: "no-path", message: "Walking directions are unavailable: no verified walkway connects these places yet." });
