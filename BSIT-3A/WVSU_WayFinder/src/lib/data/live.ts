// LIVE data from Supabase REST (PostgREST) with the publishable key. RLS limits every table to
// published/verified rows; queries also filter explicitly and name their columns.
import { looksLikeRoomCode, normalizeRoomCode } from "../search";
import type { CampusPaths, Faculty, Place, PlaceView, ProcessGuide } from "../types";

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isLiveConfigured = Boolean(url && key);
export const functionsUrl = url ? `${url}/functions/v1` : "";
export const publishableKey = key ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key!, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
  return (await res.json()) as T;
}

/** Characters that have meaning inside a PostgREST filter value. */
const clean = (s: string) => s.replace(/[*,()\\]/g, " ").trim();

// ---- Places ------------------------------------------------------------------------------
interface Row {
  id: string; kind: Place["kind"]; name: string; short_name: string | null; room_code: string | null;
  floor: number | null; parent_id: string | null; lng: number | null; lat: number | null;
  status: Place["status"]; source: string | null; parent?: Row | null;
}

function toPlace(r: Row): Place {
  return {
    id: r.id, kind: r.kind, name: r.name, shortName: r.short_name ?? undefined, roomCode: r.room_code ?? undefined,
    floor: r.floor ?? undefined, parentId: r.parent_id ?? undefined, lng: r.lng ?? undefined, lat: r.lat ?? undefined,
    status: r.status, source: r.source ?? undefined,
  };
}

const toView = (r: Row): PlaceView => ({ place: toPlace(r), parent: r.parent ? toPlace(r.parent) : undefined });
const SELECT = "select=*,parent:places!parent_id(*)";
const places = (query: string) => get<Row[]>(`places?${SELECT}&status=eq.verified&${query}`);


export async function liveSearch(q: string): Promise<PlaceView[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];

  // First: exact canonical room-code search.
  if (looksLikeRoomCode(trimmed)) {
    const code = normalizeRoomCode(trimmed);

    const exactMatches = await places(
      `room_code=eq.${encodeURIComponent(code)}`
    );

    if (exactMatches.length > 0) {
      return exactMatches.map(toView);
    }
  }

  // Second: general directory search.
  const n = encodeURIComponent(clean(trimmed));

  return (
    await places(
      `or=(` +
        `name.ilike.*${n}*,` +
        `short_name.ilike.*${n}*,` +
        `room_code.ilike.*${n}*,` +
        `room_label.ilike.*${n}*,` +
        `description.ilike.*${n}*,` +
        `phone_extension.ilike.*${n}*` +
      `)&limit=25`
    )
  ).map(toView);
}

export async function liveGetPlace(id: string): Promise<PlaceView | null> {
  const rows = await places(`id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] ? toView(rows[0]) : null;
}

export async function liveList(): Promise<PlaceView[]> {
  const pageSize = 500;
  const allRows: Row[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = await places(
      `order=name.asc,id.asc&limit=${pageSize}&offset=${offset}`
    );

    allRows.push(...page);

    if (page.length < pageSize) break;
  }

  return allRows.map(toView);
}

// ---- Faculty (public.faculty_directory) --------------------------------------------------
// Columns confirmed against the live table: record_id, full_name, college_unit, college_code,
// department, position_title, is_published, review_status. There is no office-link column, so live
// teachers never get "Show on map": the UI says "Office location unconfirmed".

const PLACE_FIELDS =
  "id,kind,name,short_name,room_code,floor,parent_id,lng,lat,status,source";

export const FACULTY_COLUMNS =
  `id,full_name,position_title,official_email,office_hours,` +
  `college:places!faculty_college_id_fkey(id,name,short_name),` +
  `office:places!faculty_office_id_fkey(${PLACE_FIELDS},parent:places!parent_id(${PLACE_FIELDS}))`;

interface FacultyCollegeRow {
  id: string;
  name: string;
  short_name: string | null;
}

interface FacultyRow {
  id: string;
  full_name: string;
  position_title: string | null;
  official_email: string | null;
  office_hours: string | null;
  college: FacultyCollegeRow | null;
  office: Row | null;
}

const VERIFIED_FACULTY = "status=eq.verified";

function toFaculty(r: FacultyRow): Faculty {
  return {
    id: String(r.id),
    fullName: r.full_name,
    positionTitle: r.position_title ?? undefined,
    collegeUnit: r.college?.name ?? undefined,
    collegeCode: r.college?.short_name ?? undefined,
    officialEmail: r.official_email ?? undefined,
    officeHours: r.office_hours ?? undefined,

    office: r.office
      ? {
          id: r.office.id,
          name: r.office.name,
          floor: r.office.floor ?? undefined,
          status: r.office.status,
          lng: r.office.lng ?? undefined,
          lat: r.office.lat ?? undefined,
          parent: r.office.parent
            ? {
                id: r.office.parent.id,
                name: r.office.parent.name,
                lng: r.office.parent.lng ?? undefined,
                lat: r.office.parent.lat ?? undefined,
                status: r.office.parent.status,
              }
            : undefined,
        }
      : undefined,

    isDemo: false,
  };
}

export async function liveSearchFaculty(q: string): Promise<Faculty[]> {
  const name = clean(q);
  const encoded = encodeURIComponent(name);

  const filter = name
    ? `&or=(full_name.ilike.*${encoded}*,official_email.ilike.*${encoded}*,position_title.ilike.*${encoded}*)`
    : "";

  return (
    await get<FacultyRow[]>(
      `faculty_directory?select=${FACULTY_COLUMNS}&${VERIFIED_FACULTY}${filter}&order=full_name.asc&limit=500`
    )
  ).map(toFaculty);
}

export async function liveGetFaculty(id: string): Promise<Faculty | null> {
  const rows = await get<FacultyRow[]>(
    `faculty_directory?select=${FACULTY_COLUMNS}&${VERIFIED_FACULTY}&id=eq.${encodeURIComponent(id)}&limit=1`
  );

  return rows[0] ? toFaculty(rows[0]) : null;
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
export async function liveCampus(): Promise<CampusPaths> {
  const v = "status=eq.verified";
  const [entrances, nodes, edges, floorPlans] = await Promise.all([
    get<{ id: string; building_id: string; name: string; lng: number; lat: number; node_id: string | null }[]>(`entrances?select=id,building_id,name,lng,lat,node_id&${v}`),
    get<{ id: string; lng: number; lat: number }[]>(`walk_nodes?select=id,lng,lat&${v}`),
    get<{ id: string; from_node: string; to_node: string; length_m: number | null }[]>(`walk_edges?select=id,from_node,to_node,length_m&${v}`),
    get<{ id: string; building_id: string; floor: number; label: string | null; image_url: string }[]>(`floor_plans?select=id,building_id,floor,label,image_url&${v}`),
  ]);
  return {
    entrances: entrances.map((e) => ({ id: e.id, buildingId: e.building_id, name: e.name, lng: e.lng, lat: e.lat, nodeId: e.node_id ?? undefined })),
    nodes,
    edges: edges.map((e) => ({ id: e.id, from: e.from_node, to: e.to_node, lengthM: e.length_m ?? undefined })),
    floorPlans: floorPlans.map((f) => ({ id: f.id, buildingId: f.building_id, floor: f.floor, label: f.label ?? undefined, imageUrl: f.image_url })),
  };
}
