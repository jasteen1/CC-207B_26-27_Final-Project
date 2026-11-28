import { useAdminData } from "../AdminData";
import AdminIcon from "../components/AdminIcon";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export default function SettingsPage() {
  const { places, userEmail, refreshPlaces, isLoading } = useAdminData();

  function exportCsv() {
    const columns = ["id", "kind", "name", "shortName", "roomCode", "floor", "parentId", "description", "photoUrl", "lng", "lat", "status", "source", "updatedAt"];
    const rows = places.map((place) => columns.map((column) => csvCell((place as unknown as Record<string, unknown>)[column])).join(","));
    const csv = [columns.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wvsu-wayfinder-directory.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Settings</h1>
          <p>Campus information and the connected directory database.</p>
        </div>
        <button type="button" className="admin-button admin-button-outline" disabled={isLoading} onClick={() => void refreshPlaces().catch(() => undefined)}>
          <AdminIcon name="refresh" size={17} /> {isLoading ? "Refreshing…" : "Refresh records"}
        </button>
      </div>

      <section className="admin-panel admin-settings-panel">
        <div className="admin-panel-header"><h2>Campus</h2></div>
        <div className="admin-setting-row"><span>University</span><strong>West Visayas State University</strong></div>
        <div className="admin-setting-row"><span>Campus</span><strong>La Paz Main Campus, Iloilo City</strong></div>
        <div className="admin-setting-row"><span>Student application</span><strong>WVSU WayFinder</strong></div>
      </section>

      <section className="admin-panel admin-settings-panel">
        <div className="admin-panel-header"><h2>Supabase connection</h2></div>
        <div className="admin-setting-row"><span>Connection</span><strong className="admin-connected-label"><i /> Connected</strong></div>
        <div className="admin-setting-row"><span>Signed in as</span><strong>{userEmail}</strong></div>
        <div className="admin-setting-row"><span>Directory records</span><strong>{places.length}</strong></div>
        <div className="admin-setting-row">
          <span>Download all directory records</span>
          <button type="button" className="admin-button admin-button-outline" onClick={exportCsv} disabled={!places.length}><AdminIcon name="download" size={17} /> Export CSV</button>
        </div>
      </section>

      <div className="admin-map-warning admin-settings-warning">
        <AdminIcon name="alert" size={18} />
        <div><strong>Database changes are live</strong><span>Adding and editing a place writes directly to public.places. Publishing makes a verified record available to the student app; archiving hides it from student searches without deleting it.</span></div>
      </div>
    </>
  );
}
