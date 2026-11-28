import { useMemo, useState } from "react";
import { useAdminData, facultyStatusLabels } from "../AdminData";
import type { AdminFaculty } from "../AdminData";
import AdminIcon from "../components/AdminIcon";
import FacultyFormDrawer from "../components/FacultyFormDrawer";

type StatusFilter = "all" | "verified" | "unverified" | "demo";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FacultyPage() {
  const { faculties, isLoading, refreshFaculty } = useAdminData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<AdminFaculty | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return faculties.filter((faculty) => {
      const matchesQuery = !needle || [
        faculty.fullName,
        faculty.positionTitle,
        faculty.officialEmail,
        faculty.collegeName,
        faculty.collegeShortName,
        faculty.officeName,
        faculty.officeBuildingName,
        faculty.officeHours,
      ].some((value) => value?.toLowerCase().includes(needle));
      return matchesQuery && (status === "all" || faculty.status === status);
    }).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [faculties, query, status]);

  const counts = {
    all: faculties.length,
    verified: faculties.filter((faculty) => faculty.status === "verified").length,
    unverified: faculties.filter((faculty) => faculty.status === "unverified").length,
    demo: faculties.filter((faculty) => faculty.status === "demo").length,
  };

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Faculty</h1>
          <p>Manage faculty profiles and their verified campus office locations.</p>
        </div>
        <div className="admin-faculty-heading-actions">
          <button type="button" className="admin-button admin-button-outline" onClick={() => void refreshFaculty().catch(() => undefined)} disabled={isLoading}>
            <AdminIcon name="refresh" size={17} /> Refresh
          </button>
          <button type="button" className="admin-button admin-button-primary" onClick={() => setAdding(true)}>
            <AdminIcon name="plus" size={19} /> Add faculty
          </button>
        </div>
      </div>

      <section className="admin-stat-grid admin-faculty-stats">
        <article className="admin-stat-card">
          <div className="admin-stat-top">Total faculty <AdminIcon name="faculty" size={17} /></div>
          <strong>{counts.all}</strong>
          <small>Records in faculty_directory</small>
        </article>
        <article className="admin-stat-card">
          <div className="admin-stat-top">Published <AdminIcon name="check" size={17} /></div>
          <strong>{counts.verified}</strong>
          <small>Visible to student search</small>
        </article>
        <article className="admin-stat-card admin-stat-warn">
          <div className="admin-stat-top">Needs review <AdminIcon name="clock" size={17} /></div>
          <strong>{counts.unverified}</strong>
          <small>Hidden until verified</small>
        </article>
        {counts.demo > 0 && (
          <article className="admin-stat-card">
            <div className="admin-stat-top">Sample records</div>
            <strong>{counts.demo}</strong>
            <small>Demo data only</small>
          </article>
        )}
      </section>

      <section className="admin-directory-controls admin-faculty-controls">
        <label className="admin-directory-search">
          <AdminIcon name="search" size={19} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, college, office or email" aria-label="Search faculty" />
        </label>
        <div className="admin-filter-pills" aria-label="Filter faculty by status">
          <button type="button" className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>All <span>{counts.all}</span></button>
          <button type="button" className={status === "verified" ? "active" : ""} onClick={() => setStatus("verified")}>Published <span>{counts.verified}</span></button>
          <button type="button" className={status === "unverified" ? "active" : ""} onClick={() => setStatus("unverified")}>Needs review <span>{counts.unverified}</span></button>
          {counts.demo > 0 && <button type="button" className={status === "demo" ? "active" : ""} onClick={() => setStatus("demo")}>Sample <span>{counts.demo}</span></button>}
        </div>
      </section>

      <div className="admin-category-toolbar admin-faculty-subbar">
        <span className="admin-result-count"><strong>{filtered.length}</strong> of {faculties.length} faculty records</span>
        <span className="admin-help-text">Only verified faculty profiles are returned to students.</span>
      </div>

      <section className="admin-panel admin-table-panel">
        {filtered.length === 0 ? (
          <div className="admin-empty">
            <span className="admin-empty-icon"><AdminIcon name="faculty" size={24} /></span>
            <strong>{faculties.length ? "No matching faculty" : "No faculty records yet"}</strong>
            <p>{faculties.length ? "Try another search or status filter." : "Add a faculty profile to begin building the university directory."}</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-faculty-table">
              <thead>
                <tr>
                  <th>Faculty member</th>
                  <th>College / Unit</th>
                  <th>Office</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Verified</th>
                  <th><span className="admin-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((faculty) => (
                  <tr key={faculty.id}>
                    <td>
                      <div className="admin-record-name admin-faculty-record-name">
                        <span className="admin-record-icon"><AdminIcon name="faculty" size={19} /></span>
                        <span>
                          <strong>{faculty.fullName}</strong>
                          <small>{faculty.officialEmail || faculty.id}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span>{faculty.collegeShortName || faculty.collegeName || "—"}</span>
                      {faculty.collegeShortName && faculty.collegeName && <small className="admin-table-secondary">{faculty.collegeName}</small>}
                    </td>
                    <td>
                      <span>{faculty.officeName || "Not assigned"}</span>
                      {faculty.officeBuildingName && <small className="admin-table-secondary">{faculty.officeBuildingName}{faculty.officeFloor != null ? ` · Floor ${faculty.officeFloor}` : ""}</small>}
                    </td>
                    <td>{faculty.positionTitle || "—"}</td>
                    <td><span className={`admin-status admin-status-${faculty.status}`}>{facultyStatusLabels[faculty.status]}</span></td>
                    <td>{formatDate(faculty.verifiedAt)}</td>
                    <td>
                      <button type="button" className="admin-text-action" onClick={() => setEditing(faculty)}>
                        <AdminIcon name="edit" size={16} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(adding || editing) && (
        <FacultyFormDrawer faculty={editing} onClose={() => { setAdding(false); setEditing(null); }} />
      )}
    </>
  );
}
