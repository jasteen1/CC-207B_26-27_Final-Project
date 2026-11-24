// Campus building polygons from the team's MapTiler "Wayfinder" dataset, fetched directly from
// MapTiler Data so edits published there show up on reload without republishing the map style.
// Pure helpers so tapping, naming and camera logic can be unit-tested without WebGL.

/** The MapTiler Data dataset that holds the WVSU building polygons. */
export const CAMPUS_DATASET_ID = "01a202a4-e7ef-7779-876d-014e0ffe2b35";

/** Never log this URL: it carries the key. */
export const campusDatasetUrl = (key: string) =>
  `https://api.maptiler.com/data/${CAMPUS_DATASET_ID}/features.json?key=${encodeURIComponent(key)}`;

export type CampusCollection = { type: "FeatureCollection"; features: GeoFeature[] };

/**
 * Fetches the live dataset. `no-cache` makes the browser revalidate every load, so a polygon edit
 * published under MapTiler → Data is picked up on reload. Null on any failure (the error is not
 * logged: it would carry the keyed URL).
 */
export async function loadCampusDataset(key: string, fetchImpl: typeof fetch = fetch): Promise<CampusCollection | null> {
  if (!key) return null;
  try {
    const res = await fetchImpl(campusDatasetUrl(key), { cache: "no-cache" });
    if (!res.ok) return null;
    const fc = (await res.json()) as Partial<CampusCollection>;
    return fc && Array.isArray(fc.features) ? { type: "FeatureCollection", features: fc.features } : null;
  } catch {
    return null;
  }
}

let pending: Promise<CampusCollection | null> | null = null;
/**
 * One fetch per page load, shared by the map and search. A failure isn't cached, so the next caller
 * tries again; a reload always fetches the live dataset afresh.
 */
export function campusDatasetOnce(key: string = import.meta.env.VITE_MAPTILER_KEY ?? ""): Promise<CampusCollection | null> {
  if (!pending) {
    pending = loadCampusDataset(key);
    void pending.then((fc) => { if (!fc) pending = null; });
  }
  return pending;
}
/** Parsed building polygons from the live dataset ([] without a key or on failure). */
export const campusBuildingsOnce = async (): Promise<Building[]> => parseBuildings(await campusDatasetOnce());
/** For tests: forget the shared fetch. */
export const resetCampusDataset = () => { pending = null; };

interface StyleLike { sources: Record<string, unknown>; layers: { id: string; source?: string }[] }

/**
 * The custom style's own copy of the dataset (its "Wayfinder" fill and label layers and their
 * source). The app draws the dataset itself, so these are removed to avoid a second, style-owned
 * outline and duplicate labels over the app's layers.
 */
export function styleCopiesOfDataset(style: StyleLike): { sources: string[]; layers: string[] } {
  const sources = Object.keys(style.sources).filter((id) => {
    const src = style.sources[id] as { type?: string; data?: unknown };
    return id === CAMPUS_DATASET_ID || (src?.type === "geojson" && typeof src.data === "string" && src.data.includes(CAMPUS_DATASET_ID));
  });
  const layers = style.layers.filter((l) => l.source !== undefined && sources.includes(l.source)).map((l) => l.id);
  return { sources, layers };
}

type Ring = [number, number][];
export interface Building {
  /** Stable selection key: `map:<place_id>` when the polygon has one, otherwise `map:f:<feature id>`. */
  key: string;
  name: string;
  /** Dataset `place_id` of every polygon drawn for this building. Links via public.building_features. */
  featureIds: number[];
  /** The dataset's own `name` values (untrimmed), used to filter the map's highlight layer. */
  rawNames: string[];
  polygons: Ring[][];
  bbox: [number, number, number, number]; // west, south, east, north
}

type Props = Record<string, unknown> | null | undefined;

/** `name:en` when present, `name` as fallback. Trailing spaces in the dataset are trimmed. */
export function buildingName(props: Props): string {
  const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return pick(props?.["name:en"]) ?? pick(props?.name) ?? "Unnamed building";
}

export function featureIdOf(props: Props): number | undefined {
  const raw = props?.place_id;
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : undefined;
}

export function buildingKey(props: Props, featureUuid?: string | number): string {
  const id = featureIdOf(props);
  return id !== undefined ? `map:${id}` : `map:f:${featureUuid ?? buildingName(props)}`;
}

interface GeoFeature { id?: string | number; properties?: Props; geometry?: { type: string; coordinates: unknown } | null }

/** Polygons only (gates are points). Polygons that share a name are one building (e.g. a two-wing hall). */
export function parseBuildings(fc: { features?: GeoFeature[] } | null | undefined): Building[] {
  const byName = new Map<string, Building>();
  for (const f of fc?.features ?? []) {
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) continue;
    const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Ring[][];
    const name = buildingName(f.properties);
    const existing = byName.get(name);
    const fid = featureIdOf(f.properties);
    const raw = f.properties?.name;
    if (existing) {
      existing.polygons.push(...polys);
      existing.bbox = bboxOf(existing.polygons);
      if (fid !== undefined) existing.featureIds.push(fid);
      if (typeof raw === "string" && !existing.rawNames.includes(raw)) existing.rawNames.push(raw);
      continue;
    }
    byName.set(name, { key: buildingKey(f.properties, f.id), name, featureIds: fid !== undefined ? [fid] : [], rawNames: typeof raw === "string" ? [raw] : [], polygons: polys, bbox: bboxOf(polys) });
  }
  // The key follows the lowest polygon ID, so it doesn't depend on the dataset's feature order.
  for (const b of byName.values()) { b.featureIds.sort((x, y) => x - y); if (b.featureIds.length) b.key = `map:${b.featureIds[0]}`; }
  return [...byName.values()];
}

function bboxOf(polys: Ring[][]): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of polys) for (const [x, y] of p[0] ?? []) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [w, s, e, n];
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The building whose outline contains the point (holes respected). */
export function buildingAt(buildings: Building[], lng: number, lat: number): Building | undefined {
  return buildings.find((b) => b.polygons.some(([outer, ...holes]) => outer && inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h))));
}

/** Metres from a point to the nearest edge of a building's outline; 0 when the point is inside it. */
export function distanceToBuildingM(b: Building, lng: number, lat: number): number {
  if (buildingAt([b], lng, lat)) return 0;
  // Local flat projection around the point: fine at campus scale (a few hundred metres).
  const mPerDeg = (6371000 * Math.PI) / 180, kx = mPerDeg * Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const poly of b.polygons) for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][0] - lng) * kx, ay = (ring[j][1] - lat) * mPerDeg, bx = (ring[i][0] - lng) * kx, by = (ring[i][1] - lat) * mPerDeg;
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

/** Every outline a GPS accuracy circle (centre lng/lat, radius in metres) reaches, nearest first. */
export function buildingsWithin(buildings: Building[], lng: number, lat: number, radiusM: number): Building[] {
  return buildings.map((b) => ({ b, d: distanceToBuildingM(b, lng, lat) })).filter((h) => h.d <= radiusM).sort((x, y) => x.d - y.d).map((h) => h.b);
}

export const findBuilding = (buildings: Building[], key: string | null | undefined) =>
  key ? buildings.find((b) => b.key === key) : undefined;

/** The building a rendered map feature belongs to (matched by name, so either wing of a hall works). */
export const buildingOfFeature = (buildings: Building[], props: Props) => {
  const name = buildingName(props);
  return buildings.find((b) => b.name === name);
};

/**
 * The smallest pan (in screen px) that brings a building's on-screen box inside the free part of the
 * map, i.e. not under the place card. 0,0 when it is already visible. A box larger than the free
 * area is centred in it instead.
 */
export function panToReveal(
  box: { left: number; top: number; right: number; bottom: number },
  view: { width: number; height: number },
  inset: { top?: number; right?: number; bottom?: number; left?: number },
  margin = 16,
): [number, number] {
  const L = (inset.left ?? 0) + margin, T = (inset.top ?? 0) + margin;
  const R = view.width - (inset.right ?? 0) - margin, B = view.height - (inset.bottom ?? 0) - margin;
  const axis = (lo: number, hi: number, min: number, max: number) => {
    if (hi - lo > max - min) return (lo + hi) / 2 - (min + max) / 2;
    if (lo < min) return lo - min;
    if (hi > max) return hi - max;
    return 0;
  };
  return [Math.round(axis(box.left, box.right, L, R)), Math.round(axis(box.top, box.bottom, T, B))];
}
