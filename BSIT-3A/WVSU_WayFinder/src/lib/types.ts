export type PlaceKind = "building" | "room" | "office" | "college" | "landmark";
export type DataStatus = "demo" | "unverified" | "verified";

export interface Place {
  id: string; // shared place ID used by search, directory, processes, schedule and map
  kind: PlaceKind;
  name: string;
  shortName?: string;
  roomCode?: string; // normalized, e.g. CB203
  floor?: number;
  parentId?: string;
  description?: string;
  photoUrl?: string;
  phoneExtension?: string;
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
  officialEmail?: string;
  officeHours?: string;
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
export interface FloorPlan { id: string; buildingId: string; floor: number; label?: string; imageUrl: string }
export interface CampusPaths { entrances: Entrance[]; nodes: WalkNode[]; edges: WalkEdge[]; floorPlans: FloorPlan[] }
