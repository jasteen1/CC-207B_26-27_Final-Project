export type PlaceKind = "building" | "room" | "office" | "college" | "landmark";
export type DataStatus = "demo" | "unverified" | "verified";

export interface Place {
  id: string; // shared place ID used by search, directory, processes, schedule and map
  kind: PlaceKind;
  name: string;
  shortName?: string;
  roomCode?: string; // normalized, e.g. CB203 (what searches match)
  /** The label exactly as printed on the classroom door, e.g. "ICT 201". Shown to students. */
  roomLabel?: string;
  floor?: number;
  parentId?: string;
  lng?: number;
  lat?: number;
  status: DataStatus;
  source?: string;
}

/** A place together with its parent (a room's building). */
export interface PlaceView {
  place: Place;
  parent?: Place;
}

export interface DataResult<T> {
  data: T;
  mode: "live" | "demo";
  /** Set in demo mode: data is a labeled fixture, not university information. */
  notice?: string;
}

/** A teacher's office, used only to decide whether "Show on map" is allowed. */
export interface FacultyOffice {
  id: string;
  name: string;
  floor?: number;
  status: DataStatus;
  lng?: number;
  lat?: number;
  parent?: { id: string; name: string; lng?: number; lat?: number; status: DataStatus };
}

/** public.faculty_directory (published + verified rows only). */
export interface Faculty {
  id: string; // record_id
  fullName: string;
  collegeUnit?: string;
  collegeCode?: string;
  department?: string;
  positionTitle?: string;
  /** Only set when a VERIFIED office link exists. The live table has no office link yet. */
  office?: FacultyOffice;
  isDemo: boolean;
}

export interface ProcessRequirement { position: number; kind: "document" | "note"; text: string }
export interface ProcessStep { position: number; officePlaceId?: string; title: string; action: string }
export interface ProcessGuide {
  id: string;
  name: string;
  summary?: string;
  beforeYouStart?: string;
  requirements: ProcessRequirement[];
  steps: ProcessStep[];
  isDemo: boolean;
}

export interface Entrance { id: string; buildingId: string; name: string; lng: number; lat: number; nodeId?: string }
export interface WalkNode { id: string; lng: number; lat: number }
export interface WalkEdge { id: string; from: string; to: string; lengthM?: number }
export interface FloorPlan { id: string; buildingId: string; floor: number; label?: string; imageUrl: string; width?: number; height?: number }
/**
 * Where a room or office sits on one specific blueprint. Every number is a fraction (0-1) of that
 * image's width (x) or height (y), so the highlight stays on the room at any zoom or screen size.
 */
export interface RoomSpot {
  id: string;
  floorPlanId: string;
  placeId: string;
  /** Label as printed on the blueprint. */
  label: string;
  shape: "rect" | "polygon" | "marker";
  x: number; y: number; w?: number; h?: number;
  /** polygon only: [x, y] fractions, in order. */
  points?: [number, number][];
}
export interface CampusPaths { entrances: Entrance[]; nodes: WalkNode[]; edges: WalkEdge[]; floorPlans: FloorPlan[]; roomSpots: RoomSpot[] }

/** Which building the Campus Map card is about: a tapped map polygon, or a place record (a map pin). */
export type BuildingRef = { featureIds: number[] } | { placeId: string };

/** A VERIFIED place record linked to a building polygon, with what is known inside it. */
export interface BuildingDetails {
  place: Place;
  description?: string;
  /** Public photo URL. Unset: the card shows "Building photo coming soon". */
  photoUrl?: string;
  offices: Place[];
  rooms: Place[];
  /** Floors known from rooms, offices and approved floor plans, ascending. */
  floors: number[];
  /** Approved (verified) floor plans, e.g. Canva blueprint exports. */
  floorPlans: FloorPlan[];
  /** Every map polygon linked to this place (some buildings are drawn as several polygons). */
  featureIds: number[];
}
