// DEMO fixtures only. Used when Supabase is not configured; never mixed into live results.
import fixtures from "../../data/demo/places.json";
import facultyFixtures from "../../data/demo/faculty.json";
import processFixtures from "../../data/demo/processes.json";
import campusFixtures from "../../data/demo/campus.json";
import { looksLikeRoomCode, normalizeRoomCode } from "../search";
import type { CampusPaths, Faculty, Place, PlaceView, ProcessGuide } from "../types";

const places = fixtures.places as Place[];
const byId = new Map(places.map((p) => [p.id, p]));

function view(place: Place): PlaceView {
  return { place, parent: place.parentId ? byId.get(place.parentId) : undefined };
}

export async function demoSearch(q: string): Promise<PlaceView[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];

  // Prioritize exact normalized room-code matches.
  if (looksLikeRoomCode(trimmed)) {
    const code = normalizeRoomCode(trimmed);

    const exactMatches = places.filter(
      (p) => p.roomCode && normalizeRoomCode(p.roomCode) === code
    );

    if (exactMatches.length > 0) {
      return exactMatches.map(view);
    }
  }

  // Search all available directory information.
  const needle = trimmed.toLowerCase();

  return places
    .filter((p) => {
      const searchableFields = [
        p.name,
        p.shortName,
        p.roomCode,
        p.description,
        p.phoneExtension,
      ];

      return searchableFields.some((field) =>
        field?.toLowerCase().includes(needle)
      );
    })
    .map(view);
}

export async function demoGetPlace(id: string): Promise<PlaceView | null> {
  const p = byId.get(id);
  return p ? view(p) : null;
}

export async function demoList(): Promise<PlaceView[]> {
  return places.map(view);
}

// ---- Faculty -----------------------------------------------------------------------------
interface DemoFaculty {
  recordId: string; fullName: string; collegeUnit?: string; collegeCode?: string; department?: string;
  positionTitle?: string; officePlaceId?: string; isPublished: boolean; reviewStatus: string;
}

function toFaculty(f: DemoFaculty): Faculty {
  const o = f.officePlaceId ? byId.get(f.officePlaceId) : undefined;
  const parent = o?.parentId ? byId.get(o.parentId) : undefined;
  return {
    id: f.recordId, fullName: f.fullName, collegeUnit: f.collegeUnit, collegeCode: f.collegeCode,
    department: f.department, positionTitle: f.positionTitle, isDemo: true,
    office: o && {
      id: o.id, name: o.name, floor: o.floor, status: o.status, lng: o.lng, lat: o.lat,
      parent: parent && { id: parent.id, name: parent.name, lng: parent.lng, lat: parent.lat, status: parent.status },
    },
  };
}

/** Same publication rule as live: is_published = true AND review_status = 'verified'. */
const visibleFaculty = () =>
  (facultyFixtures.faculty as DemoFaculty[]).filter((f) => f.isPublished && f.reviewStatus === "verified");

export async function demoSearchFaculty(q: string): Promise<Faculty[]> {
  const needle = q.trim().toLowerCase();
  return visibleFaculty().filter((f) => f.fullName.toLowerCase().includes(needle)).map(toFaculty);
}

export async function demoGetFaculty(id: string): Promise<Faculty | null> {
  const f = visibleFaculty().find((x) => x.recordId === id);
  return f ? toFaculty(f) : null;
}

// ---- Processes ---------------------------------------------------------------------------
const processes = (processFixtures.processes as Omit<ProcessGuide, "isDemo">[]).map((p) => ({ ...p, isDemo: true }));

export async function demoProcesses(q: string): Promise<ProcessGuide[]> {
  const needle = q.trim().toLowerCase();
  return processes.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.summary?.toLowerCase().includes(needle));
}

export async function demoProcess(id: string): Promise<ProcessGuide | null> {
  return processes.find((p) => p.id === id) ?? null;
}

// ---- Campus paths ------------------------------------------------------------------------
export async function demoCampus(): Promise<CampusPaths> {
  return campusFixtures as unknown as CampusPaths;
}
