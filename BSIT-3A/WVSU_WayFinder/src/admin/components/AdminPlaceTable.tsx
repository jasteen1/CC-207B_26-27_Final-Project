import type { AdminPlace } from "../AdminData";
import { kindLabels, statusLabels } from "../AdminData";
import AdminIcon from "./AdminIcon";

export function StatusBadge({ status }: { status: AdminPlace["status"] }) {
  return <span className={`admin-status admin-status-${status}`}>{statusLabels[status]}</span>;
}

export default function AdminPlaceTable({
  places,
  onEdit,
  allPlaces = places,
}: {
  places: AdminPlace[];
  onEdit: (place: AdminPlace) => void;
  allPlaces?: AdminPlace[];
}) {
  if (places.length === 0) {
    return (
      <div className="admin-empty">
        <span className="admin-empty-icon"><AdminIcon name="directory" size={24} /></span>
        <strong>No matching records</strong>
        <p>Try changing your search or filters, or add a new location.</p>
      </div>
    );
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Where</th>
            <th>Status</th>
            <th>Updated</th>
            <th><span className="admin-visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {places.map((place) => (
            <tr key={place.id}>
              <td>
                <div className="admin-record-name">
                  <span className="admin-record-icon">
                    <AdminIcon name={place.kind === "building" ? "building" : place.kind === "room" ? "rooms" : place.kind === "office" ? "office" : place.kind === "college" ? "college" : place.kind === "unit" ? "building" : "landmark"} size={19} />
                  </span>
                  <span>
                    <strong>{place.name}</strong>
                    <small>{place.roomCode || place.shortName || place.id}</small>
                  </span>
                </div>
              </td>
              <td>{kindLabels[place.kind]}</td>
              <td>{place.parentId ? (allPlaces.find((item) => item.id === place.parentId)?.name ?? "Building not found") : "—"}</td>
              <td><StatusBadge status={place.status} /></td>
              <td>{place.updatedAt}</td>
              <td>
                <button type="button" className="admin-text-action" onClick={() => onEdit(place)}>
                  <AdminIcon name="edit" size={16} /> Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
