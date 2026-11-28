export type AdminPlaceKind =
  | "building"
  | "room"
  | "office"
  | "college"
  | "unit"
  | "landmark";

export type AdminDataStatus = "demo" | "unverified" | "verified" | "archived";
export type AdminPublicationStatus = Exclude<AdminDataStatus, "demo">;

export interface AdminPlace {
  id: string;
  kind: AdminPlaceKind;
  name: string;
  shortName?: string;
  roomCode?: string;
  floor?: number;
  parentId?: string;
  description?: string;
  photoUrl?: string;
  lng?: number;
  lat?: number;
  status: AdminDataStatus;
  source?: string;
  updatedAt: string;
}

export type AdminPlaceInput = Omit<AdminPlace, "updatedAt">;

export type AdminFacultyStatus = "demo" | "unverified" | "verified";

/** A faculty row joined to its college/unit and office place records. */
export interface AdminFaculty {
  id: string;
  fullName: string;
  positionTitle?: string;
  collegeId?: string;
  collegeName?: string;
  collegeShortName?: string;
  officeId?: string;
  officeName?: string;
  officeFloor?: number;
  officeBuildingName?: string;
  officialEmail?: string;
  officeHours?: string;
  status: AdminFacultyStatus;
  source?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

/** Only verified/unverified are offered when creating or editing a real faculty record. */
export interface AdminFacultyInput {
  id?: string;
  fullName: string;
  positionTitle?: string;
  collegeId?: string;
  officeId?: string;
  officialEmail?: string;
  officeHours?: string;
  status: Exclude<AdminFacultyStatus, "demo">;
  source?: string;
}

export interface AdminActivity {
  id: string;
  title: string;
  detail: string;
  time: string;
}

export interface AdminAuthUser {
  id: string;
  email?: string;
}

export interface AdminSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type?: string;
  user: AdminAuthUser;
}

export type AdminAuthState = "checking" | "signed-out" | "authenticated" | "not-configured";
