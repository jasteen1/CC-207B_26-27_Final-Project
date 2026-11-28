import { useState } from "react";
import { useAdminData } from "../AdminData";
import type { AdminPlaceKind } from "../AdminData";
import PlaceFormDrawer from "../components/PlaceFormDrawer";
import AdminIcon from "../components/AdminIcon";
import { StatusBadge } from "../components/AdminPlaceTable";

export default function OverviewPage() {
  const { places, activities } = useAdminData();
  const [drawerKind, setDrawerKind] = useState<AdminPlaceKind | null>(null);
  const buildings = places.filter((place) => place.kind === "building");
  const published = places.filter((place) => place.status === "verified").length;
  const needsReview = places.filter((place) => place.status === "unverified");
  const archived = places.filter((place) => place.status === "archived").length;
  const mappedBuildings = buildings.filter((place) => place.lng != null && place.lat != null).length;

  const stats = [
    { label: "Directory entries", value: places.length, note: "Records loaded from Supabase", icon: "directory" as const },
    { label: "Published", value: published, note: "Verified records", icon: "check" as const },
    { label: "Needs review", value: needsReview.length, note: "Hidden from students", icon: "alert" as const, warn: true },
    { label: "Buildings mapped", value: `${mappedBuildings} of ${buildings.length}`, note: "Buildings with coordinates", icon: "map" as const },
  ];

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Overview</h1>
          <p>Keep the campus directory accurate so students find the right room.</p>
        </div>
        <button type="button" className="admin-button admin-button-primary" onClick={() => setDrawerKind("building")}>
          <AdminIcon name="plus" size={19} /> Add location
        </button>
      </div>

      <div className="admin-stat-grid">
        {stats.map((stat) => (
          <article key={stat.label} className={`admin-stat-card${stat.warn ? " admin-stat-warn" : ""}`}>
            <div className="admin-stat-top"><span>{stat.label}</span><AdminIcon name={stat.icon} size={19} /></div>
            <strong>{stat.value}</strong>
            <small>{stat.note}</small>
          </article>
        ))}
      </div>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Needs review</h2>
              <p>Records waiting for verification</p>
            </div>
            <span className="admin-count-pill">{needsReview.length}</span>
          </div>
          {needsReview.length > 0 ? (
            <div className="admin-review-list">
              {needsReview.slice(0, 6).map((place) => (
                <div className="admin-review-row" key={place.id}>
                  <span className="admin-record-icon"><AdminIcon name={place.kind === "building" ? "building" : place.kind === "room" ? "rooms" : "office"} /></span>
                  <div><strong>{place.name}</strong><small>{place.kind}</small></div>
                  <StatusBadge status={place.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty admin-empty-compact">
              <span className="admin-empty-icon"><AdminIcon name="check" size={22} /></span>
              <strong>No records need review</strong>
              <p>New records marked “Needs review” will appear here.</p>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Recent activity</h2>
              <p>Changes made during this admin session</p>
            </div>
          </div>
          <div className="admin-activity-list">
            {activities.map((activity) => (
              <div className="admin-activity-row" key={activity.id}>
                <span className="admin-activity-dot" />
                <div><strong>{activity.title}</strong><small>{activity.detail}</small></div>
                <time>{activity.time}</time>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-panel admin-add-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Add to the directory</h2>
            <p>Add a new campus destination directly to the Supabase directory.</p>
          </div>
        </div>
        <div className="admin-quick-actions">
          {(["building", "room", "office"] as AdminPlaceKind[]).map((kind) => (
            <button type="button" className="admin-quick-action" key={kind} onClick={() => setDrawerKind(kind)}>
              <AdminIcon name={kind === "building" ? "building" : kind === "room" ? "rooms" : "office"} size={21} />
              <span>Add {kind}</span>
              <AdminIcon name="plus" size={17} />
            </button>
          ))}
        </div>
        <div className="admin-demo-note"><AdminIcon name="alert" size={16} /> {needsReview.length} records need review and {archived} records are archived. Only published records are shown to students.</div>
      </section>

      {drawerKind && <PlaceFormDrawer initialKind={drawerKind} onClose={() => setDrawerKind(null)} />}
    </>
  );
}
