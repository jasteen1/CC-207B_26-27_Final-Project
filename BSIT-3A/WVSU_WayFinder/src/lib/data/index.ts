import type { BuildingDetails, BuildingRef, CampusPaths, DataResult, Faculty, PlaceView, ProcessGuide } from "../types";
import * as demo from "./demo";
import * as live from "./live";

export const { isLiveConfigured } = live;

const NOT_CONFIGURED = "Supabase is not configured. Showing DEMO records, not official WVSU information.";

/**
 * Live when Supabase is configured (a failed request throws: callers show an error + Retry).
 * Demo records are used ONLY when Supabase is not configured at all. They are never a fallback for live.
 */
async function resolve<T>(liveFn: () => Promise<T>, demoFn: () => Promise<T>): Promise<DataResult<T>> {
  if (!live.isLiveConfigured) return { data: await demoFn(), mode: "demo", notice: NOT_CONFIGURED };
  return { data: await liveFn(), mode: "live" };
}

export const searchPlaces = (q: string): Promise<DataResult<PlaceView[]>> => resolve(() => live.liveSearch(q), () => demo.demoSearch(q));
export const getPlace = (id: string): Promise<DataResult<PlaceView | null>> => resolve(() => live.liveGetPlace(id), () => demo.demoGetPlace(id));
export const listPlaces = (): Promise<DataResult<PlaceView[]>> => resolve(live.liveList, demo.demoList);

export const searchFaculty = (q: string): Promise<DataResult<Faculty[]>> => resolve(() => live.liveSearchFaculty(q), () => demo.demoSearchFaculty(q));
export const getFaculty = (id: string): Promise<DataResult<Faculty | null>> => resolve(() => live.liveGetFaculty(id), () => demo.demoGetFaculty(id));

export const listProcesses = (q: string): Promise<DataResult<ProcessGuide[]>> => resolve(() => live.liveProcesses(q), () => demo.demoProcesses(q));
export const getProcess = (id: string): Promise<DataResult<ProcessGuide | null>> => resolve(() => live.liveProcess(id), () => demo.demoProcess(id));

export const getCampusPaths = (): Promise<DataResult<CampusPaths>> => resolve(live.liveCampus, demo.demoCampus);
export const getBuilding = (ref: BuildingRef): Promise<DataResult<BuildingDetails | null>> => resolve(() => live.liveBuilding(ref), () => demo.demoBuilding(ref));
