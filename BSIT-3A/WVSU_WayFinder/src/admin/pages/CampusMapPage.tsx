import { useAdminData } from "../AdminData";
import AdminIcon from "../components/AdminIcon";

export default function CampusMapPage() {
  const { places } = useAdminData();
  const buildings = places.filter((place) => place.kind === "building");
  const mappedBuildings = buildings.filter((place) => place.lng != null && place.lat != null);
  const unmappedBuildings = buildings.filter((place) => place.lng == null || place.lat == null);

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Campus map</h1>
          <p>Review building coordinates before connecting verified campus paths.</p>
        </div>
      </div>

      <div className="admin-stat-grid admin-map-stats">
        <article className="admin-stat-card"><div className="admin-stat-top"><span>Buildings</span><AdminIcon name="building" /></div><strong>{buildings.length}</strong><small>Loaded from Supabase</small></article>
        <article className="admin-stat-card"><div className="admin-stat-top"><span>Mapped buildings</span><AdminIcon name="map" /></div><strong>{mappedBuildings.length}</strong><small>With longitude and latitude</small></article>
        <article className="admin-stat-card"><div className="admin-stat-top"><span>Need coordinates</span><AdminIcon name="alert" /></div><strong>{unmappedBuildings.length}</strong><small>Not yet placed on the map</small></article>
        <article className="admin-stat-card"><div className="admin-stat-top"><span>Coordinate coverage</span><AdminIcon name="check" /></div><strong>{buildings.length ? `${Math.round((mappedBuildings.length / buildings.length) * 100)}%` : "0%"}</strong><small>Based on building records</small></article>
      </div>

      <div className="admin-map-content-grid">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Map workspace</h2><p>Only saved coordinates will be used here.</p></div></div>
          <div className="admin-map-placeholder">
            <div className="admin-map-placeholder-icon"><AdminIcon name="map" size={34} /></div>
            <strong>Campus map editor is the next mapping step</strong>
            <p>The directory is now connected to Supabase. The interactive map, entrances, walking paths and floor-plan layers will be enabled after their coordinates and map records are reviewed.</p>
            <span>No sample coordinates are being presented as real campus navigation data.</span>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Buildings and coordinates</h2><p>{mappedBuildings.length} of {buildings.length} buildings have coordinates</p></div></div>
          <div className="admin-building-list">
            {buildings.length ? buildings.map((building) => {
              const mapped = building.lng != null && building.lat != null;
              return (
                <div className="admin-building-row" key={building.id}>
                  <span className="admin-record-icon"><AdminIcon name="building" /></span>
                  <div><strong>{building.name}</strong><small>{mapped ? `${building.lat}, ${building.lng}` : "Coordinates not added"}</small></div>
                  <span className={`admin-status ${mapped ? "admin-status-verified" : "admin-status-unverified"}`}>{mapped ? "Mapped" : "Needs coordinates"}</span>
                </div>
              );
            }) : <div className="admin-empty"><strong>No buildings yet</strong><p>Add building records to begin mapping the campus.</p></div>}
          </div>
        </section>
      </div>
    </>
  );
}
