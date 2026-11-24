// Turns what a student typed into destinations: confirmed place records first, then what the map and
// the room-code prefixes can honestly say. Pure, so web and the shared trip fixtures test it directly.
import prefixFile from "../../data/room-prefixes.json";
import { parseRoomCode } from "../search";
import type { PlaceView } from "../types";

export interface RoomPrefix { prefix: string; suppliedName: string; mapName: string | null; status: string; note?: string }
export const ROOM_PREFIXES = prefixFile.prefixes as RoomPrefix[];

/** A building polygon from the MapTiler dataset (see features/map/buildings.ts). */
export interface MapBuildingRef { key: string; name: string; featureIds: number[] }

export type SearchHit =
  /** A confirmed (or demo) place record. */
  | { kind: "place"; view: PlaceView }
  /**
   * Only the prefix is known: points to a building, room not confirmed, no floor. `building` is the
   * polygon when the map is loaded (unset if the map couldn't be loaded, e.g. offline).
   */
  | { kind: "prefix"; code: string; label: string; prefix: string; number: string; buildingName: string; building?: MapBuildingRef; message: string }
  /** The prefix is known but its building isn't on the map. */
  | { kind: "prefix-unmapped"; code: string; label: string; prefix: string; message: string }
  /** A building drawn on the campus map whose name matches. */
  | { kind: "mapped"; building: MapBuildingRef; note?: string };

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const words = (s: string) => norm(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean);

/** Display label for a typed code: "ict-201" -> "ICT 201". */
export const codeLabel = (prefix: string, number: string) => `${prefix} ${number}`;

export function prefixPointer(input: string, map: MapBuildingRef[], prefixes = ROOM_PREFIXES): SearchHit | null {
  const c = parseRoomCode(input);
  if (!c) return null;
  const p = prefixes.find((x) => x.prefix === c.prefix);
  if (!p) return null;
  const label = codeLabel(c.prefix, c.number);
  const building = p.mapName ? map.find((b) => norm(b.name) === norm(p.mapName!)) : undefined;
  // "Not on the map" only when the map actually loaded and the name is missing (or was never matched).
  if (!p.mapName || (!building && map.length > 0)) {
    return { kind: "prefix-unmapped", code: c.code, label, prefix: c.prefix,
      message: `${c.prefix} is listed as ${p.suppliedName}, which isn’t on the campus map yet. Room ${c.number} hasn’t been confirmed yet.` };
  }
  const buildingName = building?.name ?? p.mapName;
  return { kind: "prefix", code: c.code, label, prefix: c.prefix, number: c.number, buildingName, building,
    message: `${c.prefix} points to ${buildingName}. Room ${c.number} hasn’t been confirmed yet.` };
}

/**
 * Combines record results with map and prefix knowledge.
 * - A room code with a record → that record only (the record has the building and floor).
 * - A room code without a record → the prefix pointer (never a floor).
 * - A name → matching records, then map buildings that no matching record already covers. A college
 *   or office name that only matches a building says so: affiliation is not an office location.
 */
export function resolveSearch(query: string, records: PlaceView[], map: MapBuildingRef[], prefixes = ROOM_PREFIXES): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const code = parseRoomCode(q);
  if (code) {
    const exact = records.filter((v) => v.place.roomCode === code.code);
    if (exact.length) return exact.map((view) => ({ kind: "place" as const, view }));
    const ptr = prefixPointer(q, map, prefixes);
    if (ptr) return [ptr];
    // Not a known prefix: fall through so "GSO 1"-style names still find buildings by name.
  }
  const hits: SearchHit[] = records.map((view) => ({ kind: "place" as const, view }));
  const recordNames = new Set(records.map((v) => norm(v.place.name)));
  const officeRecords = records.some((v) => v.place.kind === "office");
  const qw = words(q).filter((w) => w !== "office" && w !== "the" && w !== "of");
  if (!qw.length) return hits;
  for (const b of map) {
    const bw = words(b.name).join(" ");
    if (!qw.every((w) => bw.split(" ").some((x) => x.startsWith(w)))) continue;
    if (recordNames.has(norm(b.name))) continue;
    hits.push({ kind: "mapped", building: b, note: officeRecords ? undefined : "Building on the campus map. No office inside it has been confirmed yet." });
  }
  // Buildings associated with the query only through the team's prefix list (e.g. NAB ↔ College of
  // Education). Shown as an association, never as the office's location.
  for (const p of prefixes) {
    if (!p.mapName || !norm(p.suppliedName).includes(norm(q)) || norm(p.mapName).includes(norm(q))) continue;
    const b = map.find((x) => norm(x.name) === norm(p.mapName!));
    if (b && !hits.some((h) => h.kind === "mapped" && h.building.key === b.key)) {
      hits.push({ kind: "mapped", building: b, note: `Associated with ${q.trim()} (room prefix ${p.prefix}). This is not a confirmed office location.` });
    }
  }
  return hits;
}
