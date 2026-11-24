import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// MapLibre needs WebGL; jsdom has none. A tiny stand-in lets map screens render their panels.
vi.mock("maplibre-gl", () => {
  class Map { addControl() {} on() {} remove() {} isStyleLoaded() { return false; } flyTo() {} fitBounds() {} setStyle() {} getSource() {} addSource() {} addLayer() {} getLayer() {} setFilter() {} }
  class Marker { setLngLat() { return this; } addTo() { return this; } remove() {} }
  class NavigationControl {}
  class LngLatBounds { extend() { return this; } }
  return { Map, Marker, NavigationControl, LngLatBounds, setWorkerUrl() {} };
});

beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});

// UI tests share the CPU with the Postgres (PGlite) migration tests; give findBy* queries room on a busy machine.
import { configure } from "@testing-library/react";
configure({ asyncUtilTimeout: 3000 });
