// LIVE data from Supabase REST (PostgREST) with the publishable key. RLS limits every table to
// published/verified rows; queries also filter explicitly and name their columns.
import { looksLikeRoomCode, normalizeRoomCode } from "../search";
import type { BuildingDetails, BuildingRef, CampusPaths, Faculty, FloorPlan, Place, PlaceView, ProcessGuide, RoomSpot } from "../types";
import { assembleBuilding } from "./building";

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isLiveConfigured = Boolean(url && key);
export const functionsUrl = url ? `${url}/functions/v1` : "";
export const publishableKey = key ?? "";

export class RestError extends Error { constructor(public status: number) { super(`Supabase REST ${status}`); } }

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key!, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new RestError(res.status);
  return (await res.json()) as T;
}

/** Characters that have meaning inside a PostgREST filter value. */
const clean = (s: string) => s.replace(/[*,()\\]/g, " ").trim();

// ---- Places ------------------------------------------------------------------------------
interface Row {
  id: string; kind: Place["kind"]; name: string; short_name: string | null; room_code: string | null; room_label?: string | null;
  floor: number | null; parent_id: string | null; lng: number | null; lat: number | null;
  status: Place["status"]; source: string | null; parent?: Row | null;
}

function toPlace(r: Row): Place {
  return {
    id: r.id, kind: r.kind, name: r.name, shortName: r.short_name ?? undefined, roomCode: r.room_code ?? undefined, roomLabel: r.room_label ?? undefined,
    floor: r.floor ?? undefined, parentId: r.parent_id ?? undefined, lng: r.lng ?? undefined, lat: r.lat ?? undefined,
    status: r.status, source: r.source ?? undefined,
  };
}

const toView = (r: Row): PlaceView => ({ place: toPlace(r), parent: r.parent && !Array.isArray(r.parent) ? toPlace(r.parent) : undefined });
// `parent:parent_id(*)` embeds the row parent_id points to (one object); `parent:places!parent_id(*)`
// would make PostgREST return the row's children as a list instead.
const SELECT = "select=*,parent:parent_id(*)";
const places = (query: string) => get<Row[]>(`places?${SELECT}&status=eq.verified&${query}`);

export async function liveSearch(q: string): Promise<PlaceView[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  if (looksLikeRoomCode(trimmed)) {
    return (await places(`room_code=eq.${encodeURIComponent(normalizeRoomCode(trimmed))}`)).map(toView);
  }
  const n = encodeURIComponent(clean(trimmed));
  return (await places(`or=(name.ilike.*${n}*,short_name.ilike.${n})&limit=25`)).map(toView);
}

export async function liveGetPlace(id: string): Promise<PlaceView | null> {
  const rows = await places(`id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] ? toView(rows[0]) : null;
}

export async function liveList(): Promise<PlaceView[]> {
  return (await places("order=name.asc&limit=500")).map(toView);
}

// ---- Faculty (public.faculty_directory) --------------------------------------------------
// Columns confirmed against the live table: record_id, full_name, college_unit, college_code,
// department, position_title, is_published, review_status. There is no office-link column, so live
// teachers never get "Show on map": the UI says "Office location unconfirmed".
export const FACULTY_COLUMNS = "record_id,full_name,college_unit,college_code,department,position_title";
const PUBLISHED = "is_published=eq.true&review_status=eq.verified";

interface FacultyRow {
  record_id: string | number; full_name: string; college_unit: string | null; college_code: string | null;
  department: string | null; position_title: string | null;
}

const toFaculty = (r: FacultyRow): Faculty => ({
  id: String(r.record_id), fullName: r.full_name, collegeUnit: r.college_unit ?? undefined,
  collegeCode: r.college_code ?? undefined, department: r.department ?? undefined,
  positionTitle: r.position_title ?? undefined, isDemo: false,
});

// public.faculty (0002_faculty.sql) is what the migrations create and what the live project has; the
// faculty_directory table above is used when it exists. A 404 on faculty_directory (PGRST205: table not
// in the schema) falls back to public.faculty, reading only the columns 0002 grants to students. RLS
// returns verified teachers only.
export const FACULTY_0002_COLUMNS = "id,full_name,department,college_id,office_id,official_email,office_hours,verified_at";
interface Faculty0002Row { id: string; full_name: string; department: string | null; college_id: string | null; office_id: string | null }

/** Office only from a VERIFIED office place (RLS hides the rest). A college affiliation never counts. */
async function from0002(rows: Faculty0002Row[]): Promise<Faculty[]> {
  const ids = [...new Set(rows.flatMap((r) => [r.office_id, r.college_id]).filter((x): x is string => !!x))];
  const linked = ids.length ? await places(`id=in.(${ids.map((i) => `"${clean(i)}"`).join(",")})`) : [];
  const byId = new Map(linked.map((r) => [r.id, r]));
  return rows.map((r) => {
    const office = r.office_id ? byId.get(r.office_id) : undefined;
    const college = r.college_id ? byId.get(r.college_id) : undefined;
    return {
      id: r.id, fullName: r.full_name, department: r.department ?? undefined, collegeUnit: college?.name, isDemo: false,
      office: office && {
        id: office.id, name: office.name, floor: office.floor ?? undefined, status: office.status, lng: office.lng ?? undefined, lat: office.lat ?? undefined,
        parent: office.parent ? { id: office.parent.id, name: office.parent.name, lng: office.parent.lng ?? undefined, lat: office.parent.lat ?? undefined, status: office.parent.status } : undefined,
      },
    };
  });
}

async function facultyQuery(directory: string, fallback: string): Promise<Faculty[]> {
  try {
    return (await get<FacultyRow[]>(directory)).map(toFaculty);
  } catch (e) {
    if (!(e instanceof RestError && e.status === 404)) throw e;
    return from0002(await get<Faculty0002Row[]>(fallback));
  }
}

export async function liveSearchFaculty(q: string): Promise<Faculty[]> {
  const name = clean(q);
  const filter = name ? `&full_name=ilike.*${encodeURIComponent(name)}*` : "";
  return facultyQuery(`faculty_directory?select=${FACULTY_COLUMNS}&${PUBLISHED}${filter}&order=full_name.asc&limit=100`,
    `faculty?select=${FACULTY_0002_COLUMNS}${filter}&order=full_name.asc&limit=100`);
}

export async function liveGetFaculty(id: string): Promise<Faculty | null> {
  const e = encodeURIComponent(id);
  const rows = await facultyQuery(`faculty_directory?select=${FACULTY_COLUMNS}&${PUBLISHED}&record_id=eq.${e}&limit=1`,
    `faculty?select=${FACULTY_0002_COLUMNS}&id=eq.${e}&limit=1`);
  return rows[0] ?? null;
}

// ---- Processes (0004_processes.sql) ------------------------------------------------------
interface ProcessRow {
  id: string; name: string; summary: string | null; before_you_start: string | null;
  process_requirements: { position: number; kind: "document" | "note"; text: string }[];
  process_steps: { position: number; office_place_id: string | null; title: string; action: string }[];
}
const PROCESS_SELECT =
  "select=id,name,summary,before_you_start,process_requirements(position,kind,text),process_steps(position,office_place_id,title,action)";

const toProcess = (r: ProcessRow): ProcessGuide => ({
  id: r.id, name: r.name, summary: r.summary ?? undefined, beforeYouStart: r.before_you_start ?? undefined,
  requirements: [...(r.process_requirements ?? [])].sort((a, b) => a.position - b.position),
  steps: [...(r.process_steps ?? [])].sort((a, b) => a.position - b.position)
    .map((s) => ({ position: s.position, officePlaceId: s.office_place_id ?? undefined, title: s.title, action: s.action })),
  isDemo: false,
});

export async function liveProcesses(q: string): Promise<ProcessGuide[]> {
  const n = clean(q);
  const filter = n ? `&or=(name.ilike.*${encodeURIComponent(n)}*,summary.ilike.*${encodeURIComponent(n)}*)` : "";
  return (await get<ProcessRow[]>(`processes?${PROCESS_SELECT}&is_published=eq.true&status=eq.verified${filter}&order=name.asc`)).map(toProcess);
}

export async function liveProcess(id: string): Promise<ProcessGuide | null> {
  const rows = await get<ProcessRow[]>(`processes?${PROCESS_SELECT}&is_published=eq.true&status=eq.verified&id=eq.${encodeURIComponent(id)}`);
  return rows[0] ? toProcess(rows[0]) : null;
}

// ---- Campus paths (0005_campus_paths.sql) ------------------------------------------------
interface PlanRow { id: string; building_id: string; floor: number; label: string | null; image_url: string; width_px?: number | null; height_px?: number | null }
/**
 * floor_plans.image_url may be a full URL, an app path (/demo/...), or a Storage path
 * ("floor-plans/quezon-hall-floor-1.png") that resolves against this project's public Storage URL,
 * so SQL never needs the project URL.
 */
export const storageUrl = (u: string) => (/^(https?:)?\/\//.test(u) || u.startsWith("/") ? u : `${url}/storage/v1/object/public/${u.replace(/^\/+/, "")}`);
const toPlan = (f: PlanRow): FloorPlan => ({
  id: f.id, buildingId: f.building_id, floor: f.floor, label: f.label ?? undefined, imageUrl: storageUrl(f.image_url),
  width: f.width_px ?? undefined, height: f.height_px ?? undefined,
});
interface SpotRow { id: string; floor_plan_id: string; place_id: string; label: string; shape: RoomSpot["shape"]; x: number; y: number; w: number | null; h: number | null; points: [number, number][] | null }

/** Room positions on blueprints (0007). Before that migration is applied the table 404s: no spots yet. */
async function liveRoomSpots(): Promise<RoomSpot[]> {
  try {
    const rows = await get<SpotRow[]>("floor_plan_rooms?select=id,floor_plan_id,place_id,label,shape,x,y,w,h,points&status=eq.verified");
    return rows.map((r) => ({ id: r.id, floorPlanId: r.floor_plan_id, placeId: r.place_id, label: r.label, shape: r.shape, x: r.x, y: r.y, w: r.w ?? undefined, h: r.h ?? undefined, points: r.points ?? undefined }));
  } catch (e) {
    if (e instanceof RestError && e.status === 404) return [];
    throw e;
  }
}

export async function liveCampus(): Promise<CampusPaths> {
  const v = "status=eq.verified";
  const [entrances, nodes, edges, floorPlans, roomSpots] = await Promise.all([
    get<{ id: string; building_id: string; name: string; lng: number; lat: number; node_id: string | null }[]>(`entrances?select=id,building_id,name,lng,lat,node_id&${v}`),
    get<{ id: string; lng: number; lat: number }[]>(`walk_nodes?select=id,lng,lat&${v}`),
    get<{ id: string; from_node: string; to_node: string; length_m: number | null }[]>(`walk_edges?select=id,from_node,to_node,length_m&${v}`),
    // select=* so the 0007 width_px/height_px columns are picked up once they exist.
    get<PlanRow[]>(`floor_plans?select=*&${v}`),
    liveRoomSpots(),
  ]);
  return {
    entrances: entrances.map((e) => ({ id: e.id, buildingId: e.building_id, name: e.name, lng: e.lng, lat: e.lat, nodeId: e.node_id ?? undefined })),
    nodes,
    edges: edges.map((e) => ({ id: e.id, from: e.from_node, to: e.to_node, lengthM: e.length_m ?? undefined })),
    floorPlans: floorPlans.map(toPlan),
    roomSpots,
  };
}

// ---- Building card (0006_building_features.sql) ------------------------------------------
/**
 * The verified place linked to a tapped polygon (or a place ID), with its rooms, offices and approved
 * floor plans. null = no verified link: the card still opens with the map's building name.
 * A 404 (migration 0006 not applied yet) also means "no link", never an error for the student.
 */
export async function liveBuilding(ref: BuildingRef): Promise<BuildingDetails | null> {
  const v = "status=eq.verified";
  try {
    let placeId: string | undefined;
    if ("placeId" in ref) placeId = ref.placeId;
    else {
      const ids = ref.featureIds.filter((n) => Number.isInteger(n) && n > 0);
      if (!ids.length) return null;
      const link = await get<{ place_id: string }[]>(`building_features?select=place_id&feature_id=in.(${ids.join(",")})&${v}&order=feature_id.asc&limit=1`);
      placeId = link[0]?.place_id;
    }
    if (!placeId) return null;
    const id = encodeURIComponent(placeId);
    const [rows, children, floorPlans, featureLinks] = await Promise.all([
      // A gate is a landmark record linked to its polygon the same way (route survey).
      get<(Row & { description?: string | null; photo_url?: string | null })[]>(`places?select=*&id=eq.${id}&kind=in.(building,landmark)&${v}&limit=1`),
      get<Row[]>(`places?select=*&parent_id=eq.${id}&${v}&order=name.asc&limit=500`),
      get<PlanRow[]>(`floor_plans?select=*&building_id=eq.${id}&${v}&order=floor.asc`),
      get<{ feature_id: number }[]>(`building_features?select=feature_id&place_id=eq.${id}&${v}`),
    ]);
    const row = rows[0];
    if (!row) return null;
    return assembleBuilding({
      place: toPlace(row), description: row.description ?? undefined, photoUrl: row.photo_url ?? undefined,
      children: children.map(toPlace),
      floorPlans: floorPlans.map(toPlan),
      featureIds: featureLinks.map((l) => l.feature_id),
    });
  } catch (e) {
    if (e instanceof RestError && e.status === 404) return null;
    throw e;
  }
}
