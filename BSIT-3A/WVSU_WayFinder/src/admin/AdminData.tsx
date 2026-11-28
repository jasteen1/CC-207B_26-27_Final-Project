import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import {
  ensureFreshAdminSession,
  fetchAdminFaculty,
  fetchAdminPlaces,
  isAdminSupabaseConfigured,
  readStoredAdminSession,
  restoreWayfinderAdminSession,
  saveAdminFaculty,
  saveAdminPlace,
  signInWayfinderAdmin,
  signOutWayfinderAdmin,
  storeAdminSession,
} from "./adminApi";
import type {
  AdminActivity,
  AdminAuthState,
  AdminDataStatus,
  AdminFaculty,
  AdminFacultyInput,
  AdminFacultyStatus,
  AdminPlace,
  AdminPlaceInput,
  AdminPlaceKind,
  AdminSession,
} from "./types";

export type {
  AdminActivity,
  AdminDataStatus,
  AdminFaculty,
  AdminFacultyInput,
  AdminFacultyStatus,
  AdminPlace,
  AdminPlaceInput,
  AdminPlaceKind,
  AdminPublicationStatus,
} from "./types";

interface AdminDataValue {
  places: AdminPlace[];
  faculties: AdminFaculty[];
  activities: AdminActivity[];
  authState: AdminAuthState;
  isConfigured: boolean;
  isLoading: boolean;
  userEmail: string;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshPlaces: () => Promise<void>;
  refreshFaculty: () => Promise<void>;
  savePlace: (place: AdminPlaceInput, isEditing: boolean) => Promise<void>;
  saveFaculty: (faculty: AdminFacultyInput, isEditing: boolean) => Promise<void>;
  clearError: () => void;
}

const AdminDataContext = createContext<AdminDataValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong while contacting Supabase.";
}

function activity(title: string, detail: string): AdminActivity {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    detail,
    time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

export function AdminDataProvider({ children }: PropsWithChildren) {
  const [places, setPlaces] = useState<AdminPlace[]>([]);
  const [faculties, setFaculties] = useState<AdminFaculty[]>([]);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [authState, setAuthState] = useState<AdminAuthState>("checking");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const sessionRef = useRef<AdminSession | null>(null);

  function updateSession(next: AdminSession | null) {
    sessionRef.current = next;
    setSession(next);
    storeAdminSession(next);
  }

  async function getUsableSession(): Promise<AdminSession> {
    const current = sessionRef.current ?? readStoredAdminSession();
    if (!current) throw new Error("Your administrator session has expired. Please sign in again.");
    const fresh = await ensureFreshAdminSession(current);
    if (fresh !== current) updateSession(fresh);
    return fresh;
  }

  async function loadPlaces(activeSession: AdminSession) {
    const rows = await fetchAdminPlaces(activeSession);
    setPlaces(rows);
    return rows;
  }

  async function loadFaculty(activeSession: AdminSession) {
    const rows = await fetchAdminFaculty(activeSession);
    setFaculties(rows);
    return rows;
  }

  async function loadAll(activeSession: AdminSession) {
    setIsLoading(true);
    setError("");
    try {
      const [placeResult, facultyResult] = await Promise.allSettled([
        fetchAdminPlaces(activeSession),
        fetchAdminFaculty(activeSession),
      ]);

      const errors: string[] = [];
      if (placeResult.status === "fulfilled") setPlaces(placeResult.value);
      else errors.push(`Directory: ${errorMessage(placeResult.reason)}`);

      if (facultyResult.status === "fulfilled") setFaculties(facultyResult.value);
      else errors.push(`Faculty: ${errorMessage(facultyResult.reason)}`);

      setError(errors.join(" "));
      const placeCount = placeResult.status === "fulfilled" ? placeResult.value.length : 0;
      const facultyCount = facultyResult.status === "fulfilled" ? facultyResult.value.length : 0;
      setActivities([activity("Connected to Supabase", `${placeCount} directory locations and ${facultyCount} faculty records loaded`)]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (!isAdminSupabaseConfigured) {
        setAuthState("not-configured");
        return;
      }
      try {
        const restored = await restoreWayfinderAdminSession();
        if (!active) return;
        if (!restored) {
          setAuthState("signed-out");
          return;
        }
        updateSession(restored);
        setAuthState("authenticated");
        setIsLoading(true);
        try {
          const [placeResult, facultyResult] = await Promise.allSettled([
            fetchAdminPlaces(restored),
            fetchAdminFaculty(restored),
          ]);
          if (!active) return;
          const errors: string[] = [];
          if (placeResult.status === "fulfilled") setPlaces(placeResult.value);
          else errors.push(`Directory: ${errorMessage(placeResult.reason)}`);
          if (facultyResult.status === "fulfilled") setFaculties(facultyResult.value);
          else errors.push(`Faculty: ${errorMessage(facultyResult.reason)}`);
          setError(errors.join(" "));
          setActivities([activity(
            "Connected to Supabase",
            `${placeResult.status === "fulfilled" ? placeResult.value.length : 0} directory locations and ${facultyResult.status === "fulfilled" ? facultyResult.value.length : 0} faculty records loaded`,
          )]);
        } finally {
          if (active) setIsLoading(false);
        }
      } catch (restoreError) {
        if (active) {
          setError(errorMessage(restoreError));
          setAuthState("signed-out");
        }
      }
    }

    void initialize();
    return () => { active = false; };
    // This is a one-time session restore on provider mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    setError("");
    try {
      const next = await signInWayfinderAdmin(email.trim(), password);
      updateSession(next);
      setAuthState("authenticated");
      await loadAll(next);
    } catch (loginError) {
      updateSession(null);
      setAuthState("signed-out");
      throw loginError;
    }
  }

  async function logout() {
    const current = sessionRef.current;
    await signOutWayfinderAdmin(current);
    updateSession(null);
    setPlaces([]);
    setFaculties([]);
    setActivities([]);
    setError("");
    setAuthState("signed-out");
  }

  async function refreshPlaces() {
    setError("");
    try {
      const current = await getUsableSession();
      setIsLoading(true);
      const rows = await loadPlaces(current);
      setActivities((currentActivities) => [activity("Directory refreshed", `${rows.length} locations loaded from Supabase`), ...currentActivities].slice(0, 8));
    } catch (refreshError) {
      const message = errorMessage(refreshError);
      setError(message);
      throw refreshError;
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshFaculty() {
    setError("");
    try {
      const current = await getUsableSession();
      setIsLoading(true);
      const rows = await loadFaculty(current);
      setActivities((currentActivities) => [activity("Faculty refreshed", `${rows.length} faculty records loaded from Supabase`), ...currentActivities].slice(0, 8));
    } catch (refreshError) {
      const message = errorMessage(refreshError);
      setError(message);
      throw refreshError;
    } finally {
      setIsLoading(false);
    }
  }

  async function savePlace(place: AdminPlaceInput, isEditing: boolean) {
    setError("");
    try {
      const current = await getUsableSession();
      await saveAdminPlace(current, place, isEditing);
      const rows = await loadPlaces(current);
      setActivities((currentActivities) => [
        activity(`${isEditing ? "Updated" : "Added"} ${place.name}`, `${place.kind} · ${place.status} · Saved to Supabase`),
        ...currentActivities,
      ].slice(0, 8));
      setPlaces(rows);
    } catch (saveError) {
      const message = errorMessage(saveError);
      setError(message);
      throw saveError;
    }
  }

  async function saveFaculty(faculty: AdminFacultyInput, isEditing: boolean) {
    setError("");
    try {
      const current = await getUsableSession();
      await saveAdminFaculty(current, faculty, isEditing);
      const rows = await loadFaculty(current);
      setActivities((currentActivities) => [
        activity(`${isEditing ? "Updated" : "Added"} ${faculty.fullName}`, `Faculty · ${faculty.status} · Saved to Supabase`),
        ...currentActivities,
      ].slice(0, 8));
      setFaculties(rows);
    } catch (saveError) {
      const message = errorMessage(saveError);
      setError(message);
      throw saveError;
    }
  }

  const value: AdminDataValue = {
    places,
    faculties,
    activities,
    authState,
    isConfigured: isAdminSupabaseConfigured,
    isLoading,
    userEmail: session?.user.email ?? "Administrator",
    error,
    login,
    logout,
    refreshPlaces,
    refreshFaculty,
    savePlace,
    saveFaculty,
    clearError: () => setError(""),
  };

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const value = useContext(AdminDataContext);
  if (!value) throw new Error("useAdminData must be used inside AdminDataProvider.");
  return value;
}

export const kindLabels: Record<AdminPlaceKind, string> = {
  building: "Building",
  room: "Room",
  office: "Office",
  college: "College",
  unit: "Unit",
  landmark: "Landmark",
};

export const statusLabels: Record<AdminDataStatus, string> = {
  demo: "Sample",
  unverified: "Needs review",
  verified: "Published",
  archived: "Archived",
};

export const facultyStatusLabels: Record<AdminFacultyStatus, string> = {
  demo: "Sample",
  unverified: "Needs review",
  verified: "Published",
};
