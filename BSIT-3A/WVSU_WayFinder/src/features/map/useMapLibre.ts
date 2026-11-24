import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
// Vite pre-bundling breaks MapLibre's default worker path; point it at the shipped worker module.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

if (typeof maplibregl.setWorkerUrl === "function") maplibregl.setWorkerUrl(workerUrl);
import { CAMPUS_BOUNDS } from "../../lib/location";
import { buildingAt, buildingOfFeature, campusDatasetOnce, panToReveal, parseBuildings, styleCopiesOfDataset, type Building, type CampusCollection } from "./buildings";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
export const hasMapTiler = Boolean(MAPTILER_KEY);
const BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#e6edf7" } }],
};
// The team's custom MapTiler style, used as the basemap. It also carries its own "Wayfinder" copy of
// the building dataset; the app removes that copy and draws the live dataset itself (see installCampus).
// The key comes from VITE_MAPTILER_KEY (.env.local, gitignored); never log this URL.
export const CAMPUS_STYLE_ID = "01a20291-e8a8-7646-9d78-2ffaf09b58b2";
const MAPTILER_STYLE = `https://api.maptiler.com/maps/${CAMPUS_STYLE_ID}/style.json?key=${encodeURIComponent(MAPTILER_KEY ?? "")}`;

export interface Pin { id: string; lng: number; lat: number; kind: "dest" | "start" | "here" | "building" | "entrance"; title: string; onClick?: () => void }

export interface BuildingOptions {
  /** Dataset `name` values of the selected building's polygons (gold outline). Empty = none. */
  highlight: string[];
  onBuildingTap: (b: Building) => void;
}

const CAMPUS_SRC = "wf-campus", FILL = "wf-buildings";
const HL_CASING = "wf-selected-casing", HL_LINE = "wf-selected", LABELS = "wf-building-labels";

/** One MapLibre map: basemap (MapTiler or labeled overlay-only), tappable campus buildings, pins and a route line. */
export function useMapLibre(container: React.RefObject<HTMLDivElement | null>, pins: Pin[], route: [number, number][] | null, opts?: BuildingOptions) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const buildingsRef = useRef<Building[]>([]);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const markers = useRef<maplibregl.Marker[]>([]);
  const routeRef = useRef(route);
  routeRef.current = route;
  const [basemapFailed, setBasemapFailed] = useState(!hasMapTiler);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map;
    try {
      // Open straight onto WVSU Main Campus, framed by the building outlines.
      map = new maplibregl.Map({ container: container.current, style: hasMapTiler ? MAPTILER_STYLE : BLANK_STYLE, bounds: CAMPUS_BOUNDS, fitBoundsOptions: { padding: 24 } });
    } catch {
      setMapError("This browser can't display the map (WebGL unavailable). Directions below still work.");
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // Fall back to the overlay only when the style itself can't load (bad key, offline). A single
    // failed tile, sprite or glyph after load must not wipe the custom building outlines.
    let styleLoaded = false;
    map.on("load", () => { styleLoaded = true; });
    map.on("error", (e: maplibregl.ErrorEvent) => {
      const status = (e.error as { status?: number } | undefined)?.status;
      if (hasMapTiler && (!styleLoaded || status === 401 || status === 403)) {
        setBasemapFailed((was) => { if (!was) map.setStyle(BLANK_STYLE); return true; });
      }
    });
    const draw = () => drawRoute(map, routeRef.current);
    map.on("load", draw);
    map.on("styledata", draw);

    // ---- Tappable buildings: fetched straight from the MapTiler Data endpoint, not via the style ----
    // Shapes, labels, taps and the gold highlight all come from this one fetch, so an edit published
    // under MapTiler → Data appears on reload without republishing the map style.
    let campus: CampusCollection | null = null;
    let removed = false;
    const install = () => {
      if (campus) installCampus(map, campus, optsRef.current?.highlight ?? []);
    };
    map.on("load", install);
    map.on("styledata", install); // also re-adds after a fallback setStyle(BLANK_STYLE)
    if (hasMapTiler) {
      void campusDatasetOnce(MAPTILER_KEY ?? "").then((fc) => {
        if (!fc || removed) return;
        campus = fc;
        const list = parseBuildings(fc);
        buildingsRef.current = list;
        setBuildings(list);
        install();
      });
    }
    map.on("click", (e) => {
      const b = pickBuilding(map, e.point, e.lngLat, buildingsRef.current, [FILL]);
      if (b) optsRef.current?.onBuildingTap(b);
    });
    map.on("mousemove", (e) => {
      const layers = [FILL, LABELS].filter((id) => map.getLayer(id));
      const over = layers.length > 0 && map.queryRenderedFeatures(e.point, { layers }).length > 0;
      map.getCanvas().style.cursor = over ? "pointer" : "";
    });
    mapRef.current = map;
    // Dev builds only: lets the browser tap-through check project real coordinates. Not in production.
    if (import.meta.env.DEV) (container.current as HTMLDivElement & { __map?: maplibregl.Map }).__map = map;
    return () => { removed = true; map.remove(); mapRef.current = null; };
  }, [container]);

  useEffect(() => {
    const map = mapRef.current;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    if (!map) return;
    for (const p of pins) {
      const el = document.createElement("button");
      el.className = `pin pin-${p.kind}`;
      if (p.kind === "here") el.innerHTML = '<span class="pin-here-dot"></span><span class="pin-here-label">You are here</span>';
      el.title = p.title;
      el.setAttribute("aria-label", p.title);
      if (p.onClick) el.addEventListener("click", p.onClick);
      // "You are here" puts its label under the dot, so anchor at the top and shift up half the dot.
      const anchor = p.kind === "dest" ? "bottom" : p.kind === "here" ? "top" : "center";
      const offset: [number, number] = p.kind === "here" ? [0, -11] : [0, 0];
      markers.current.push(new maplibregl.Marker({ element: el, anchor, offset }).setLngLat([p.lng, p.lat]).addTo(map));
    }
  }, [pins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    drawRoute(map, route);
    const focus = route?.length ? route : pins.filter((p) => p.kind === "dest" || p.kind === "start" || p.kind === "here").map((p) => [p.lng, p.lat] as [number, number]);
    if (focus.length === 1) map.flyTo({ center: focus[0], zoom: 18, duration: 500 });
    if (focus.length > 1) {
      const b = focus.reduce((acc, c) => acc.extend(c), new maplibregl.LngLatBounds(focus[0], focus[0]));
      // Extra room at the bottom so the "You are here" label clears the attribution bar.
      map.fitBounds(b, { padding: { top: 60, left: 60, right: 60, bottom: 110 }, maxZoom: 18.5, duration: 500 });
    }
  }, [route, pins]);

  const highlightKey = (opts?.highlight ?? []).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (map) setHighlight(map, opts?.highlight ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightKey]);

  /** Pan just enough that the building's outline sits in the part of the map not covered by the card. */
  const reveal = useCallback((b: Building, inset: { top?: number; right?: number; bottom?: number; left?: number }) => {
    const map = mapRef.current;
    if (!map) return;
    const [w, s, e, n] = b.bbox;
    const a = map.project([w, n]), c = map.project([e, s]);
    const box = { left: Math.min(a.x, c.x), right: Math.max(a.x, c.x), top: Math.min(a.y, c.y), bottom: Math.max(a.y, c.y) };
    const el = map.getContainer();
    const [dx, dy] = panToReveal(box, { width: el.clientWidth, height: el.clientHeight }, inset);
    if (dx || dy) map.panBy([dx, dy], { duration: 350 });
  }, []);

  return { basemapFailed, mapError, buildings, reveal };
}

/** A tap inside a polygon, on our building label, or on a basemap label that sits inside a building. */
function pickBuilding(map: maplibregl.Map, p: maplibregl.Point, at: maplibregl.LngLat, list: Building[], fills: string[]): Building | undefined {
  const box: [maplibregl.PointLike, maplibregl.PointLike] = [[p.x - 6, p.y - 6], [p.x + 6, p.y + 6]];
  if (map.getLayer(LABELS)) {
    const label = map.queryRenderedFeatures(box, { layers: [LABELS] })[0];
    if (label) return buildingOfFeature(list, label.properties);
  }
  const fillIds = fills.filter((id) => map.getLayer(id));
  if (fillIds.length) {
    const hit = map.queryRenderedFeatures(p, { layers: fillIds })[0];
    if (hit) return buildingOfFeature(list, hit.properties);
  }
  for (const f of map.queryRenderedFeatures(box)) {
    if (f.layer.type !== "symbol" || f.geometry.type !== "Point") continue;
    const [lng, lat] = f.geometry.coordinates as [number, number];
    const b = buildingAt(list, lng, lat);
    if (b) return b;
  }
  return buildingAt(list, at.lng, at.lat);
}

const NONE: maplibregl.FilterSpecification = ["==", ["get", "name"], "\u0000"];
const highlightFilter = (names: string[]): maplibregl.FilterSpecification =>
  names.length ? ["in", ["get", "name"], ["literal", names]] : NONE;

/**
 * Puts the fetched dataset on the map: drops the style's own copy of it, then adds the app's fill,
 * gold highlight and labels from one GeoJSON source. Idempotent, so it is safe on every styledata.
 */
function installCampus(map: maplibregl.Map, data: CampusCollection, highlight: string[]) {
  let style: maplibregl.StyleSpecification;
  try { style = map.getStyle(); } catch { return; } // style not parsed yet: load/styledata retries
  if (!style) return;
  const stale = styleCopiesOfDataset(style as Parameters<typeof styleCopiesOfDataset>[0]);
  for (const id of stale.layers) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of stale.sources) if (map.getSource(id)) map.removeSource(id);

  const polygonsOnly: maplibregl.FilterSpecification = ["==", ["geometry-type"], "Polygon"];
  const filter = highlightFilter(highlight);
  try {
    if (!map.getSource(CAMPUS_SRC)) map.addSource(CAMPUS_SRC, { type: "geojson", data: data as maplibregl.GeoJSONSourceSpecification["data"] });
    // Below the route line when it exists, so the route stays readable across buildings.
    const below = map.getLayer("route") ? "route" : undefined;
    // Same look as the custom style's "Wayfinder" fill.
    if (!map.getLayer(FILL)) map.addLayer({ id: FILL, type: "fill", source: CAMPUS_SRC, filter: polygonsOnly, paint: { "fill-color": "hsla(201, 70%, 43%, 0.8)", "fill-outline-color": "#000000" } }, below);
    if (!map.getLayer(HL_CASING)) map.addLayer({ id: HL_CASING, type: "line", source: CAMPUS_SRC, filter, paint: { "line-color": "#ffffff", "line-width": 7 } }, below);
    if (!map.getLayer(HL_LINE)) map.addLayer({ id: HL_LINE, type: "line", source: CAMPUS_SRC, filter, paint: { "line-color": "#f2b134", "line-width": 4 } }, below);
  } catch { return; /* style not ready yet: load/styledata retries */ }
  try {
    // The tappable building label. Needs the style's glyphs, so the overlay-only fallback skips it.
    if (!map.getLayer(LABELS)) {
      map.addLayer({
        id: LABELS, type: "symbol", source: CAMPUS_SRC, minzoom: 16, filter: polygonsOnly,
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Roboto Medium", "Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 16, 10, 18, 13],
          "text-max-width": 7,
          "text-padding": 2,
        },
        paint: { "text-color": "#1d3f8c", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
      });
    }
  } catch { /* no glyphs on the overlay-only style */ }
}

function setHighlight(map: maplibregl.Map, names: string[]) {
  const filter = highlightFilter(names);
  for (const id of [HL_CASING, HL_LINE]) if (map.getLayer(id)) map.setFilter(id, filter);
}

function drawRoute(map: maplibregl.Map, coords: [number, number][] | null) {
  // Not isStyleLoaded(): it stays false while any source is still loading. addSource only needs the
  // style itself; before that it throws and the "load"/"styledata" handlers draw it later.
  const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords ?? [] } };
  try {
    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(data);
    else {
      map.addSource("route", { type: "geojson", data });
      map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1d3f8c", "line-width": 6, "line-opacity": 0.85 } });
    }
  } catch {
    /* style not ready yet: the load/styledata handler redraws */
  }
}
