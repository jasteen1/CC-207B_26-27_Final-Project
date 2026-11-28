import { useMemo, useState } from "react";
import { useAdminData, kindLabels } from "../AdminData";
import type { AdminPlaceKind } from "../AdminData";
import type { AdminPlace } from "../AdminData";
import PlaceFormDrawer from "../components/PlaceFormDrawer";
import AdminPlaceTable from "../components/AdminPlaceTable";
import AdminIcon from "../components/AdminIcon";

export default function CategoryPage({
  kind,
  description,
}: {
  kind: AdminPlaceKind;
  description: string;
}) {
  const { places } = useAdminData();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminPlace | null>(null);
  const [adding, setAdding] = useState(false);
  const records = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return places.filter((place) => place.kind === kind && (!needle || [
      place.name, place.shortName, place.roomCode, place.description,
    ].some((value) => value?.toLowerCase().includes(needle))));
  }, [places, kind, query]);

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{kindLabels[kind]}s</h1>
          <p>{description}</p>
        </div>
        <button type="button" className="admin-button admin-button-primary" onClick={() => setAdding(true)}>
          <AdminIcon name="plus" size={19} /> Add {kind}
        </button>
      </div>

      <div className="admin-category-toolbar">
        <label className="admin-directory-search">
          <AdminIcon name="search" size={19} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${kindLabels[kind].toLowerCase()}s`} />
        </label>
        <span className="admin-result-count"><strong>{records.length}</strong> records</span>
      </div>

      <section className="admin-panel admin-table-panel">
        <AdminPlaceTable places={records} allPlaces={places} onEdit={setEditing} />
      </section>

      {(adding || editing) && (
        <PlaceFormDrawer initialKind={kind} place={editing} onClose={() => { setAdding(false); setEditing(null); }} />
      )}
    </>
  );
}
