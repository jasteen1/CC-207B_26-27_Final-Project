import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminFaculty, AdminFacultyInput } from "../AdminData";
import { useAdminData } from "../AdminData";
import AdminIcon from "./AdminIcon";

interface Props {
  onClose: () => void;
  faculty?: AdminFaculty | null;
}

type FacultyStatus = "unverified" | "verified";

interface FormState {
  fullName: string;
  positionTitle: string;
  collegeId: string;
  officeId: string;
  officialEmail: string;
  officeHours: string;
  source: string;
  status: FacultyStatus;
}

function emptyForm(): FormState {
  return {
    fullName: "",
    positionTitle: "",
    collegeId: "",
    officeId: "",
    officialEmail: "",
    officeHours: "",
    source: "",
    status: "unverified",
  };
}

function fromFaculty(faculty: AdminFaculty): FormState {
  return {
    fullName: faculty.fullName,
    positionTitle: faculty.positionTitle ?? "",
    collegeId: faculty.collegeId ?? "",
    officeId: faculty.officeId ?? "",
    officialEmail: faculty.officialEmail ?? "",
    officeHours: faculty.officeHours ?? "",
    source: faculty.source ?? "",
    status: faculty.status === "verified" ? "verified" : "unverified",
  };
}

export default function FacultyFormDrawer({ onClose, faculty }: Props) {
  const { places, saveFaculty } = useAdminData();
  const [form, setForm] = useState<FormState>(() => faculty ? fromFaculty(faculty) : emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(faculty);

  useEffect(() => {
    setForm(faculty ? fromFaculty(faculty) : emptyForm());
    setError("");
  }, [faculty]);

  const colleges = useMemo(
    () => places.filter((place) => place.kind === "college" || place.kind === "unit").sort((a, b) => a.name.localeCompare(b.name)),
    [places],
  );
  const offices = useMemo(
    () => places.filter((place) => place.kind === "office").sort((a, b) => a.name.localeCompare(b.name)),
    [places],
  );
  const selectedCollege = places.find((place) => place.id === form.collegeId);
  const selectedOffice = places.find((place) => place.id === form.officeId);
  const officeBuilding = selectedOffice?.parentId ? places.find((place) => place.id === selectedOffice.parentId) : undefined;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const fullName = form.fullName.trim();
    if (!fullName) {
      setError("Enter the faculty member's full name.");
      return;
    }
    if (form.officialEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.officialEmail.trim())) {
      setError("Enter a valid official email address.");
      return;
    }
    if (form.status === "verified" && !form.source.trim()) {
      setError("Add an information source before publishing this faculty profile.");
      return;
    }

    const input: AdminFacultyInput = {
      id: faculty?.id,
      fullName,
      positionTitle: form.positionTitle.trim() || undefined,
      collegeId: form.collegeId || undefined,
      officeId: form.officeId || undefined,
      officialEmail: form.officialEmail.trim() || undefined,
      officeHours: form.officeHours.trim() || undefined,
      source: form.source.trim() || undefined,
      status: form.status,
    };

    setSaving(true);
    setError("");
    try {
      await saveFaculty(input, isEditing);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this faculty profile to Supabase.");
    } finally {
      setSaving(false);
    }
  }

  const previewName = form.fullName.trim() || "Faculty name";
  const previewPosition = form.positionTitle.trim() || "Position not specified";
  const previewCollege = selectedCollege?.name || "College not assigned";
  const previewOffice = selectedOffice?.name || "Office location unconfirmed";

  return (
    <div className="admin-drawer-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-faculty-drawer-title">
        <header className="admin-drawer-header">
          <div>
            <h2 id="admin-faculty-drawer-title">{isEditing ? "Edit faculty profile" : "Add faculty member"}</h2>
            <p>{isEditing ? "Update faculty directory information" : "Create a new faculty directory record"}</p>
          </div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close form">
            <AdminIcon name="close" size={22} />
          </button>
        </header>

        <div className="admin-drawer-body">
          <form id="admin-faculty-form" className="admin-place-form" onSubmit={submit}>
            <label className="admin-field">
              <span className="admin-field-label">Full name <em>Required</em></span>
              <input autoFocus required value={form.fullName} onChange={(event) => update("fullName", event.target.value)} placeholder="e.g. Juan Dela Cruz" />
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Position / designation <em>Optional</em></span>
              <input value={form.positionTitle} onChange={(event) => update("positionTitle", event.target.value)} placeholder="e.g. Instructor I, Associate Professor" />
            </label>

            <div className="admin-form-grid">
              <label className="admin-field">
                <span className="admin-field-label">College / unit <em>Optional</em></span>
                <select value={form.collegeId} onChange={(event) => update("collegeId", event.target.value)}>
                  <option value="">Choose a college or unit</option>
                  {colleges.map((place) => <option key={place.id} value={place.id}>{place.name}{place.shortName ? ` (${place.shortName})` : ""}</option>)}
                </select>
              </label>
              <label className="admin-field">
                <span className="admin-field-label">Office location <em>Optional</em></span>
                <select value={form.officeId} onChange={(event) => update("officeId", event.target.value)}>
                  <option value="">Choose an office</option>
                  {offices.map((place) => {
                    const parent = place.parentId ? places.find((item) => item.id === place.parentId) : undefined;
                    return <option key={place.id} value={place.id}>{place.name}{parent ? ` · ${parent.name}` : ""}</option>;
                  })}
                </select>
              </label>
            </div>

            <label className="admin-field">
              <span className="admin-field-label">Official email <em>Optional</em></span>
              <input type="email" value={form.officialEmail} onChange={(event) => update("officialEmail", event.target.value)} placeholder="name@wvsu.edu.ph" />
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Office / consultation hours <em>Optional</em></span>
              <textarea rows={3} value={form.officeHours} onChange={(event) => update("officeHours", event.target.value)} placeholder="e.g. Monday–Wednesday, 9:00 AM–12:00 PM" />
            </label>

            <label className="admin-field">
              <span className="admin-field-label">Information source <em>{form.status === "verified" ? "Required to publish" : "Optional until verification"}</em></span>
              <input value={form.source} onChange={(event) => update("source", event.target.value)} placeholder="e.g. Official WVSU faculty directory / college confirmation" />
            </label>

            <div className="admin-field">
              <span className="admin-field-label">Publication status</span>
              <div className="admin-status-tabs admin-faculty-status-tabs">
                <button type="button" className={form.status === "unverified" ? "selected" : ""} onClick={() => update("status", "unverified")}>Needs review</button>
                <button type="button" className={form.status === "verified" ? "selected status-verified" : ""} onClick={() => update("status", "verified")}>Published</button>
              </div>
              <p className="admin-help-text">
                {form.status === "verified"
                  ? "This profile will appear in student faculty search. Supabase records the verifying administrator and timestamp."
                  : "This profile remains hidden from students until an administrator verifies it."}
              </p>
            </div>

            {error && <p className="admin-form-error" role="alert">{error}</p>}
          </form>

          <aside className="admin-student-preview admin-faculty-preview">
            <div className="admin-preview-heading">
              <strong>Student profile preview</strong>
              <span>Preview only</span>
            </div>
            <div className="admin-faculty-preview-card">
              <div className="admin-faculty-avatar"><AdminIcon name="faculty" size={30} /></div>
              <span className="admin-phone-kind">FACULTY</span>
              <h3>{previewName}</h3>
              <p className="admin-faculty-preview-position">{previewPosition}</p>
              <div className="admin-faculty-preview-detail">
                <span>COLLEGE / UNIT</span>
                <strong>{previewCollege}</strong>
              </div>
              <div className="admin-faculty-preview-detail">
                <span>OFFICE</span>
                <strong>{previewOffice}</strong>
                {officeBuilding && <small>{officeBuilding.name}{selectedOffice?.floor != null ? ` · Floor ${selectedOffice.floor}` : ""}</small>}
              </div>
              {form.officialEmail.trim() && <div className="admin-faculty-preview-email">{form.officialEmail.trim()}</div>}
              {form.officeHours.trim() && <div className="admin-faculty-preview-hours">{form.officeHours.trim()}</div>}
            </div>
            <div className={`admin-preview-notice${form.status === "verified" ? " published" : ""}`}>
              <AdminIcon name={form.status === "verified" ? "check" : "alert"} size={16} />
              <span>{form.status === "verified" ? "Marked for publication after saving." : "Hidden from students until verified."}</span>
            </div>
          </aside>
        </div>

        <footer className="admin-drawer-footer">
          <span>Faculty records are saved directly to Supabase.</span>
          <button type="button" className="admin-button admin-button-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="admin-faculty-form" className="admin-button admin-button-primary" disabled={saving}>
            <AdminIcon name="check" size={17} /> {saving ? "Saving…" : "Save faculty"}
          </button>
        </footer>
      </section>
    </div>
  );
}
