/* Campus room directory: every room and office transcribed from the blueprints.
   Starts from the bundled copy (rooms.ts) so it works offline, then swaps in Supabase's
   public.room_directory view when the app has Supabase keys and the view returns rows. */
import { useEffect, useState } from "react";
import { DIR_BUILDINGS, DIR_ROOMS, type DirRoom } from "./rooms";

export interface RoomEntry extends DirRoom { building: string; buildingShort: string; app: string | null; aka: string[] }

const withBuilding = (r: DirRoom): RoomEntry => {
  const b = DIR_BUILDINGS[r.b];
  return { ...r, building: b?.name ?? r.b, buildingShort: b?.short ?? "", app: b?.app ?? null, aka: b?.aka ?? [] };
};
export const BUNDLED_ROOMS: RoomEntry[] = DIR_ROOMS.map(withBuilding);

interface LiveRow {
  id: string; room_type: DirRoom["type"] | null; kind: string; name: string; room_label: string | null; room_code: string | null; floor: number | null;
  building_id: string; building_name: string; building_short_name: string | null; building_aka: string[] | null;
}
const COLS = "id,kind,room_type,name,room_label,room_code,floor,building_id,building_name,building_short_name,building_aka";

export async function fetchRoomDirectory(): Promise<RoomEntry[] | null> {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, ""), key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || import.meta.env.MODE === "test") return null;
  const res = await fetch(`${url}/rest/v1/room_directory?select=${COLS}&order=building_name.asc,floor.asc,name.asc&limit=5000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as LiveRow[];
  if (!rows.length) return null;
  return rows.map((r) => ({
    id: r.id, b: r.building_id, name: r.name, label: r.room_label ?? r.name, code: r.room_code, floor: r.floor,
    type: r.room_type ?? (r.kind === "office" ? "office" : "room"),
    building: r.building_name, buildingShort: r.building_short_name ?? "", app: DIR_BUILDINGS[r.building_id]?.app ?? null, aka: r.building_aka ?? [],
  }));
}

/** The directory, live from Supabase when available; `live` says which copy is showing. */
export function useRoomDirectory() {
  const [state, setState] = useState<{ rooms: RoomEntry[]; live: boolean }>({ rooms: BUNDLED_ROOMS, live: false });
  useEffect(() => {
    let on = true;
    fetchRoomDirectory().then((rows) => { if (on && rows) setState({ rooms: rows, live: true }); }).catch(() => {});
    return () => { on = false; };
  }, []);
  return state;
}

const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Matches a door code typed any way ("nab 201", "NAB-201"), a room or office name, or a building name. */
export function matchRoom(r: RoomEntry, q: string): boolean {
  if (!q) return true;
  const sq = squash(q);
  if (r.code && sq && r.code.startsWith(sq)) return true;
  const hay = [r.name, r.label, r.building, r.buildingShort, ...r.aka].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export const TYPE_LABEL: Record<DirRoom["type"], string> = { room: "Room", lab: "Lab", office: "Office", facility: "Facility" };
