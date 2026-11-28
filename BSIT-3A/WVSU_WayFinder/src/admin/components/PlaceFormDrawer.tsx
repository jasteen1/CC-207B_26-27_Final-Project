import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminPlace, AdminPlaceInput, AdminPlaceKind, AdminPublicationStatus } from "../AdminData";
import { useAdminData, kindLabels, statusLabels } from "../AdminData";
import { normalizeRoomCode } from "../../lib/search";
import AdminIcon from "./AdminIcon";

interface Props {
  onClose: () => void;
  initialKind?: AdminPlaceKind;
  place?: AdminPlace | null;
}

interface FormState {
  kind: AdminPlaceKind;
  name: string;
  shortName: string;
  roomCode: string;
  parentId: string;
  floor: string;
  description: string;
  photoUrl: string;
  lng: string;
  lat: string;
  source: string;
  status: AdminPublicationStatus;
}

function emptyForm(kind: AdminPlaceKind = "building"): FormState {
  return {
    kind, name: "", shortName: "", roomCode: "", parentId: "", floor: "",
    description: "", photoUrl: "", lng: "", lat: "", source: "", status: "unverified",
  };
}

function fromPlace(place: AdminPlace): FormState {
  return {
    kind: place.kind,
    name: place.name,
    shortName: place.shortName ?? "",
    roomCode: place.roomCode ?? "",
    parentId: place.parentId ?? "",
    floor: place.floor == null ? "" : String(place.floor),
    description: place.description ?? "",
    photoUrl: place.photoUrl ?? "",
    lng: place.lng == null ? "" : String(place.lng),
    lat: place.lat == null ? "" : String(place.lat),
    source: place.source ?? "",
    status: place.status === "demo" ? "unverified" : place.status,
  };
}

const kinds: AdminPlaceKind[] = ["building", "room", "office", "college", "landmark"];
const statuses: AdminPublicationStatus[] = ["unverified", "verified", "archived"];

export default function PlaceFormDrawer({ onClose, initialKind = "building", place }: Props) {
  const { places, savePlace } = useAdminData();
  const [form, setForm] = useState<FormState>(() => place ? fromPlace(place) : emptyForm(initialKind));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(place ? fromPlace(place) : emptyForm(initialKind));
    setError("");
  }, [place, initialKind]);

  const buildings = useMemo(() => places.filter((item) => item.kind === "building"), [places]);
  const parent = places.find((item) => item.id === form.parentId);
  const isEditing = Boolean(place);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    if (!name) {
      setError("Please enter a location name.");
      return;
    }
    if ((form.kind === "room" || form.kind === "office") && !form.parentId) {
      setError(`Choose the building where this ${form.kind} is located.`);
      return;
    }

    const roomCode = form.kind === "room" && form.roomCode.trim()
      ? normalizeRoomCode(form.roomCode)
      : undefined;
    if (roomCode) {
      const duplicate = places.some((item) => item.roomCode === roomCode && item.id !== place?.id);
      if (duplicate) {
        setError(`The room code ${roomCode} is already used by another record.`);
        return;
      }
    }

    const nextPlace: AdminPlaceInput = {
      id: place?.id ?? `wf-${form.kind}-${crypto.randomUUID()}`,
      kind: form.kind,
      name,
      shortName: form.shortName.trim() || undefined,
      roomCode,
      parentId: form.parentId || undefined,
      floor: form.floor.trim() ? Number(form.floor) : undefined,
      description: form.description.trim() || undefined,
      photoUrl: form.photoUrl.trim() || undefined,
      lng: form.lng.trim() ? Number(form.lng) : undefined,
      lat: form.lat.trim() ? Number(form.lat) : undefined,
      source: form.source.trim() || undefined,
      status: form.status,
    };
    setSaving(true);
    setError("");
    try {
      await savePlace(nextPlace, isEditing);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this location to Supabase.");
    } finally {
      setSaving(false);
    }
  }

  const previewTitle = form.name.trim() || "Untitled location";
  const previewKind = kindLabels[form.kind].toUpperCase();
  const previewWhere = parent?.name ?? (form.kind === "building" ? "Campus location" : "Building not selected");

  return (
    <div className="admin-drawer-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-drawer-title">
        <header className="admin-drawer-header">
          <div>
            <h2 id="admin-drawer-title">{isEditing ? `Edit ${kindLabels[form.kind].toLowerCase()}` : `Add ${kindLabels[form.kind].toLowerCase()}`}</h2>
            <p>{isEditing ? "Update this directory record" : "New directory record"}</p>
          </div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close form">
            <AdminIcon name="close" size={22} />
          </button>
        </header>

        <div className="admin-drawer-body">
          <form id="admin-place-form" className="admin-place-form" onSubmit={submit}>
            <div className="admin-field">
              <span className="admin-field-label">Type</span>
              <div className="admin-kind-tabs">
                {kinds.map((kind) => (
                  <button key={kind} type="button" className={form.kind === kind ? "selected" : ""} onClick={() => {
                    update("kind", kind);
                    if (kind !== "room") update("roomCode", "");
                    if (kind === "building" || kind === "landmark") update("parentId", "");
                  }}>
                    {kindLabels[kind]}
                  </button>
                ))}
              </div>
            </div>

            <label className="admin-field">
              <span className="admin-field-label">Name <em>Required</em></span>
              <input autoFocus value={form.name} onChange={(event) => update("name", event.target.value)} placeholder={form.kind === "room" ? "e.g. CICT 305" : form.kind === "building" ? "e.g. College Building" : `Enter ${form.kind} name`} />
            </label>

            <div className="admin-form-grid">
              <label className="admin-field">
                <span className="admin-field-label">Short name <em>Optional</em></span>
                <input value={form.shortName} onChange={(event) => update("shortName", event.target.value)} placeholder="e.g. CICT" />
              </label>
              {form.kind === "room" && (
                <label className="admin-field">
                  <span className="admin-field-label">Room code <em>Optional</em></span>
                  <input value={form.roomCode} onChange={(event) => update("roomCode", event.target.value)} placeholder="e.g. CICT305" />
                </label>
              )}
            </div>

            {(form.kind === "room" || form.kind === "office" || form.kind === "college") && (
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span className="admin-field-label">{form.kind === "college" ? "Home building" : "Building"} {form.kind !== "college" && <em>Required</em>}</span>
                  <select value={form.parentId} onChange={(event) => update("parentId", event.target.value)}>
                    <option value="">Choose a building</option>
                    {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
                  </select>
                </label>
                {(form.kind === "room" || form.kind === "office") && (
                  <label className="admin-field">
                    <span className="admin-field-label">Floor <em>Optional</em></span>
                    <input type="number" min="0" step="1" value={form.floor} onChange={(event) => update("floor", event.target.value)} placeholder="e.g. 3" />
                  </label>
                )}
              </div>
            )}

            <label className="admin-field">
              <span className="admin-field-label">Description <em>Optional</em></span>
              <textarea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="One line that helps students recognize this location" />
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Photo URL <em>Optional</em></span>
              <input type="url" value={form.photoUrl} onChange={(event) => update("photoUrl", event.target.value)} placeholder="https://..." />
            </label>

            <div className="admin-field">
              <span className="admin-field-label">Map coordinates <em>Optional</em></span>
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span className="admin-sub-label">Longitude</span>
                  <input type="number" step="any" value={form.lng} onChange={(event) => update("lng", event.target.value)} placeholder="Longitude" />
                </label>
                <label className="admin-field">
                  <span className="admin-sub-label">Latitude</span>
                  <input type="number" step="any" value={form.lat} onChange={(event) => update("lat", event.target.value)} placeholder="Latitude" />
                </label>
              </div>
            </div>

            <label className="admin-field">
              <span className="admin-field-label">Source / reference <em>Optional</em></span>
              <input value={form.source} onChange={(event) => update("source", event.target.value)} placeholder="e.g. verified campus document" />
            </label>

            <div className="admin-field">
              <span className="admin-field-label">Publication status</span>
              <div className="admin-status-tabs">
                {statuses.map((status) => (
                  <button key={status} type="button" className={form.status === status ? `selected status-${status}` : ""} onClick={() => update("status", status)}>
                    {statusLabels[status]}
                  </button>
                ))}
              </div>
              <p className="admin-help-text">
                {form.status === "verified" ? "Published records are intended to appear in the student directory." : form.status === "unverified" ? "Needs review records stay hidden from students." : "Archived records are retained for administrators but hidden from students."}
              </p>
            </div>

            {error && <p className="admin-form-error" role="alert">{error}</p>}
          </form>

          <aside className="admin-student-preview">
            <div className="admin-preview-heading">
              <strong>Student view</strong>
              <span>Preview only</span>
            </div>
            <div className="admin-phone">
              <div className="admin-phone-screen">
                {form.photoUrl ? (
                  <img className="admin-phone-photo" src={form.photoUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                ) : (
                  <div className="admin-phone-photo admin-phone-photo-empty">No photo yet</div>
                )}
                <span className="admin-phone-kind">{previewKind}</span>
                <h3>{previewTitle}</h3>
                <p>{form.description.trim() || previewWhere}</p>
                {form.kind === "room" && form.roomCode.trim() && <strong className="admin-phone-code">{normalizeRoomCode(form.roomCode)}</strong>}
                {form.floor.trim() && <span className="admin-phone-floor">Floor {form.floor}</span>}
                <div className="admin-phone-button">Directions</div>
              </div>
            </div>
            <div className={`admin-preview-notice ${form.status === "verified" ? "published" : ""}`}>
              {form.status === "verified" ? <AdminIcon name="check" size={16} /> : <AdminIcon name="alert" size={16} />}
              {form.status === "verified" ? "This record will be published to the student directory." : form.status === "archived" ? "This record will be archived and hidden from students." : "This record will remain hidden from students until published."}
            </div>
          </aside>
        </div>

        <footer className="admin-drawer-footer">
          <span>Changes are saved directly to Supabase.</span>
          <button type="button" className="admin-button admin-button-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-button admin-button-primary" disabled={saving} onClick={() => {
            const formElement = document.querySelector<HTMLFormElement>("#admin-place-form");
            formElement?.requestSubmit();
          }}><AdminIcon name="check" size={17} /> {saving ? "Saving…" : "Save"}</button>
        </footer>
      </section>
    </div>
  );
}
