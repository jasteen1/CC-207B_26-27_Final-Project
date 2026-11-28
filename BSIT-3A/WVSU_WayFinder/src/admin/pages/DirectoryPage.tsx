import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminData, kindLabels } from "../AdminData";
import type { AdminPlace, AdminPlaceKind } from "../AdminData";
import PlaceFormDrawer from "../components/PlaceFormDrawer";
import AdminPlaceTable from "../components/AdminPlaceTable";
import AdminIcon from "../components/AdminIcon";

type StatusFilter = "all" | "verified" | "unverified" | "archived" | "demo";
type KindFilter = "all" | AdminPlaceKind;

export default function DirectoryPage() {
  const { places } = useAdminData();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [editing, setEditing] = useState<AdminPlace | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => setQuery(params.get("q") ?? ""), [params]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return places.filter((place) => {
      const matchesQuery = !needle || [
        place.name, place.shortName, place.roomCode, place.description, place.id,
      ].some((value) => value?.toLowerCase().includes(needle));
      return matchesQuery
        && (status === "all" || place.status === status)
        && (kind === "all" || place.kind === kind);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [places, query, status, kind]);

  const counts = {
    all: places.length,
    verified: places.filter((place) => place.status === "verified").length,
    unverified: places.filter((place) => place.status === "unverified").length,
    archived: places.filter((place) => place.status === "archived").length,
    demo: places.filter((place) => place.status === "demo").length,
  };

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Directory</h1>
          <p>Every place students can search for.</p>
        </div>
        <button type="button" className="admin-button admin-button-primary" onClick={() => setAdding(true)}>
          <AdminIcon name="plus" size={19} /> Add location
        </button>
      </div>

      <section className="admin-directory-controls">
        <label className="admin-directory-search">
          <AdminIcon name="search" size={19} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search directory" aria-label="Search directory" />
        </label>
        <div className="admin-filter-pills" aria-label="Filter by publication status">
          <button className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>All <span>{counts.all}</span></button>
          <button className={status === "verified" ? "active" : ""} onClick={() => setStatus("verified")}>Published <span>{counts.verified}</span></button>
          <button className={status === "unverified" ? "active" : ""} onClick={() => setStatus("unverified")}>Needs review <span>{counts.unverified}</span></button>
          <button className={status === "archived" ? "active" : ""} onClick={() => setStatus("archived")}>Archived <span>{counts.archived}</span></button>
          {counts.demo > 0 && <button className={status === "demo" ? "active" : ""} onClick={() => setStatus("demo")}>Sample <span>{counts.demo}</span></button>}
        </div>
      </section>

      <div className="admin-directory-subbar">
        <label>
          <span>Type</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
            <option value="all">All types</option>
            {(Object.keys(kindLabels) as AdminPlaceKind[]).map((value) => <option key={value} value={value}>{kindLabels[value]}</option>)}
          </select>
        </label>
        <span className="admin-result-count"><strong>{filtered.length}</strong> of {places.length} records</span>
      </div>

      <section className="admin-panel admin-table-panel">
        <AdminPlaceTable places={filtered} allPlaces={places} onEdit={setEditing} />
      </section>

      {(adding || editing) && (
        <PlaceFormDrawer place={editing} onClose={() => { setAdding(false); setEditing(null); }} />
      )}
    </>
  );
}
