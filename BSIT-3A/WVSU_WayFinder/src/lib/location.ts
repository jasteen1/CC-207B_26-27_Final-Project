// Browser Geolocation with explicit failure reasons, so the student can always pick a start by hand.
// WVSU Main Campus, La Paz, Iloilo City: the extent of the 39 building outlines in the team's
// MapTiler "Wayfinder" dataset, as [[west, south], [east, north]]. The centre is the middle of it.
export const CAMPUS_BOUNDS: [[number, number], [number, number]] = [[122.55932, 10.71194], [122.56441, 10.71531]];
export const CAMPUS_CENTER = { lng: (CAMPUS_BOUNDS[0][0] + CAMPUS_BOUNDS[1][0]) / 2, lat: (CAMPUS_BOUNDS[0][1] + CAMPUS_BOUNDS[1][1]) / 2 };
export const CAMPUS_RADIUS_M = 900;

export type LocationFailure = "unsupported" | "insecure" | "denied" | "unavailable" | "timeout";
export interface Fix { lng: number; lat: number; accuracy: number }
export type LocationOutcome = { ok: true; fix: Fix } | { ok: false; reason: LocationFailure };

export const accuracyLabel = (m: number) => (m <= 15 ? "Good" : m <= 50 ? "Fair" : "Poor");

export const failureText: Record<LocationFailure, string> = {
  unsupported: "This browser can’t share your location.",
  insecure: "Location needs a secure (https) connection.",
  denied: "You didn’t allow location access.",
  unavailable: "Your location couldn’t be determined (common indoors).",
  timeout: "Finding your location took too long.",
};

export function getLocation(geo: Geolocation | undefined = navigator.geolocation): Promise<LocationOutcome> {
  if (typeof window !== "undefined" && !window.isSecureContext) return Promise.resolve({ ok: false, reason: "insecure" });
  if (!geo) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) =>
    geo.getCurrentPosition(
      (p) => resolve({ ok: true, fix: { lng: p.coords.longitude, lat: p.coords.latitude, accuracy: p.coords.accuracy } }),
      (e) => resolve({ ok: false, reason: e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    ),
  );
}
