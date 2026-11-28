import type { AdminFaculty, AdminFacultyInput, AdminPlace, AdminPlaceInput, AdminSession } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SESSION_KEY = "wvsu-wayfinder-admin-session-v1";
const PAGE_SIZE = 1000;

export const isAdminSupabaseConfigured = Boolean(supabaseUrl && anonKey);

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: { id: string; email?: string };
}

interface PlaceRow {
  id: string;
  kind: AdminPlace["kind"];
  name: string;
  short_name: string | null;
  room_code: string | null;
  floor: number | null;
  parent_id: string | null;
  lng: number | null;
  lat: number | null;
  status: AdminPlace["status"];
  source: string | null;
  description: string | null;
  photo_url: string | null;
  updated_at: string | null;
  verified_at: string | null;
}

function requireConfig() {
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file, then restart Vite.");
  }
}

function toSession(response: AuthResponse): AdminSession {
  const expiresAt = response.expires_at ?? Math.floor(Date.now() / 1000) + (response.expires_in ?? 3600);
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: expiresAt,
    token_type: response.token_type,
    user: response.user,
  };
}

async function responseError(response: Response): Promise<Error> {
  let message = `Supabase request failed (${response.status}).`;
  try {
    const body = await response.json() as { message?: string; error_description?: string; details?: string; hint?: string };
    message = body.message ?? body.error_description ?? body.details ?? message;
    if (body.hint) message += ` ${body.hint}`;
  } catch {
    // Keep the HTTP status message when the response is not JSON.
  }
  return new Error(message);
}

async function authPost(path: string, body: Record<string, string>): Promise<AuthResponse> {
  requireConfig();
  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: anonKey!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await responseError(response);
  return await response.json() as AuthResponse;
}

export function readStoredAdminSession(): AdminSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as AdminSession;
    if (!value.access_token || !value.refresh_token || !value.user?.id) return null;
    return value;
  } catch {
    return null;
  }
}

export function storeAdminSession(session: AdminSession | null) {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // The session remains available in memory for this tab.
  }
}

export async function refreshAdminSession(session: AdminSession): Promise<AdminSession> {
  const response = await authPost("token?grant_type=refresh_token", {
    refresh_token: session.refresh_token,
  });
  const refreshed = toSession(response);
  storeAdminSession(refreshed);
  return refreshed;
}

export async function ensureFreshAdminSession(session: AdminSession): Promise<AdminSession> {
  if (session.expires_at > Math.floor(Date.now() / 1000) + 90) return session;
  return refreshAdminSession(session);
}

async function checkAdminMembership(session: AdminSession): Promise<boolean> {
  requireConfig();
  const query = `wayfinder_admins?select=user_id&user_id=eq.${encodeURIComponent(session.user.id)}&is_active=eq.true&limit=1`;
  const response = await fetch(`${supabaseUrl}/rest/v1/${query}`, {
    headers: {
      apikey: anonKey!,
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw await responseError(response);
  const rows = await response.json() as { user_id: string }[];
  return rows.length > 0;
}

export async function signInWayfinderAdmin(email: string, password: string): Promise<AdminSession> {
  const session = toSession(await authPost("token?grant_type=password", { email, password }));
  const allowed = await checkAdminMembership(session);
  if (!allowed) {
    storeAdminSession(null);
    try {
      await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: anonKey!, Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // Local credentials are still discarded if remote sign-out is unavailable.
    }
    throw new Error("This account can sign in, but it is not registered as a WayFinder administrator. Add its Auth user ID to public.wayfinder_admins first.");
  }
  storeAdminSession(session);
  return session;
}

export async function restoreWayfinderAdminSession(): Promise<AdminSession | null> {
  const stored = readStoredAdminSession();
  if (!stored) return null;
  try {
    const session = await ensureFreshAdminSession(stored);
    if (!(await checkAdminMembership(session))) {
      storeAdminSession(null);
      return null;
    }
    storeAdminSession(session);
    return session;
  } catch {
    storeAdminSession(null);
    return null;
  }
}

export async function signOutWayfinderAdmin(session: AdminSession | null) {
  storeAdminSession(null);
  if (!session || !supabaseUrl || !anonKey) return;
  try {
    await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    // Clearing the local session is sufficient for this browser.
  }
}

async function adminRequest<T>(session: AdminSession, path: string, init: RequestInit = {}): Promise<T> {
  requireConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey!);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("Accept", "application/json");
  if (init.body != null) headers.set("Content-Type", "application/json");

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function toAdminPlace(row: PlaceRow): AdminPlace {
  const date = row.updated_at ?? row.verified_at;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    shortName: row.short_name ?? undefined,
    roomCode: row.room_code ?? undefined,
    floor: row.floor ?? undefined,
    parentId: row.parent_id ?? undefined,
    lng: row.lng ?? undefined,
    lat: row.lat ?? undefined,
    status: row.status,
    source: row.source ?? undefined,
    description: row.description ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    updatedAt: date ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
  };
}

export async function fetchAdminPlaces(session: AdminSession): Promise<AdminPlace[]> {
  const all: PlaceRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await adminRequest<PlaceRow[]>(
      session,
      `places?select=id,kind,name,short_name,room_code,floor,parent_id,lng,lat,status,source,description,photo_url,updated_at,verified_at&order=name.asc,id.asc&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all.map(toAdminPlace);
}

export async function saveAdminPlace(
  session: AdminSession,
  place: AdminPlaceInput,
  isEditing: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const isPublished = place.status === "verified";
  const payload = {
    id: place.id,
    kind: place.kind,
    name: place.name,
    short_name: place.shortName ?? null,
    room_code: place.roomCode ?? null,
    floor: place.floor ?? null,
    parent_id: place.parentId ?? null,
    lng: place.lng ?? null,
    lat: place.lat ?? null,
    status: place.status,
    source: place.source ?? null,
    description: place.description ?? null,
    photo_url: place.photoUrl ?? null,
    updated_at: now,
    verified_by: isPublished ? session.user.id : null,
    verified_at: isPublished ? now : null,
  };

  if (isEditing) {
    await adminRequest<unknown>(
      session,
      `places?id=eq.${encodeURIComponent(place.id)}`,
      { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) },
    );
  } else {
    await adminRequest<unknown>(
      session,
      "places",
      { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) },
    );
  }
}


// ---- Faculty directory ------------------------------------------------------------------
// This matches the supplied public.faculty_directory schema exactly. Faculty records use
// status='verified' for student visibility; there is no is_published or review_status column.
interface FacultyPlaceRow {
  id: string;
  name: string;
  short_name: string | null;
  kind: AdminPlace["kind"];
  status: AdminPlace["status"];
  floor?: number | null;
  parent?: { id: string; name: string } | null;
}

interface FacultyRow {
  id: string;
  full_name: string;
  position_title: string | null;
  college_id: string | null;
  office_id: string | null;
  official_email: string | null;
  office_hours: string | null;
  status: AdminFaculty["status"];
  source: string | null;
  verified_by: string | null;
  verified_at: string | null;
  college: FacultyPlaceRow | null;
  office: FacultyPlaceRow | null;
}

const FACULTY_SELECT =
  "id,full_name,position_title,college_id,office_id,official_email,office_hours,status,source,verified_by,verified_at," +
  "college:places!faculty_college_id_fkey(id,name,short_name,kind,status)," +
  "office:places!faculty_office_id_fkey(id,name,short_name,kind,status,floor,parent:places!parent_id(id,name))";

function toAdminFaculty(row: FacultyRow): AdminFaculty {
  return {
    id: row.id,
    fullName: row.full_name,
    positionTitle: row.position_title ?? undefined,
    collegeId: row.college_id ?? undefined,
    collegeName: row.college?.name ?? undefined,
    collegeShortName: row.college?.short_name ?? undefined,
    officeId: row.office_id ?? undefined,
    officeName: row.office?.name ?? undefined,
    officeFloor: row.office?.floor ?? undefined,
    officeBuildingName: row.office?.parent?.name ?? undefined,
    officialEmail: row.official_email ?? undefined,
    officeHours: row.office_hours ?? undefined,
    status: row.status,
    source: row.source ?? undefined,
    verifiedBy: row.verified_by ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
  };
}

export async function fetchAdminFaculty(session: AdminSession): Promise<AdminFaculty[]> {
  const all: FacultyRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await adminRequest<FacultyRow[]>(
      session,
      `faculty_directory?select=${FACULTY_SELECT}&order=full_name.asc,id.asc&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all.map(toAdminFaculty);
}

export async function saveAdminFaculty(
  session: AdminSession,
  faculty: AdminFacultyInput,
  isEditing: boolean,
): Promise<void> {
  const fullName = faculty.fullName.trim();
  if (!fullName) throw new Error("Enter the faculty member's full name.");
  if (faculty.status === "verified" && !faculty.source?.trim()) {
    throw new Error("Add an information source before verifying this faculty record.");
  }
  if (isEditing && !faculty.id) throw new Error("The faculty record ID is missing.");

  const verified = faculty.status === "verified";
  const now = new Date().toISOString();
  const payload = {
    full_name: fullName,
    position_title: faculty.positionTitle?.trim() || null,
    college_id: faculty.collegeId || null,
    office_id: faculty.officeId || null,
    official_email: faculty.officialEmail?.trim() || null,
    office_hours: faculty.officeHours?.trim() || null,
    status: faculty.status,
    source: faculty.source?.trim() || null,
    verified_by: verified ? session.user.id : null,
    verified_at: verified ? now : null,
  };

  if (isEditing) {
    await adminRequest<unknown>(
      session,
      `faculty_directory?id=eq.${encodeURIComponent(faculty.id!)}`,
      { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) },
    );
  } else {
    // The database generates the UUID through gen_random_uuid().
    await adminRequest<unknown>(
      session,
      "faculty_directory",
      { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) },
    );
  }
}
