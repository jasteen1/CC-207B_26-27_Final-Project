import { useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { AdminDataProvider, useAdminData } from "../AdminData";
import type { AdminIconName } from "./AdminIcon";
import AdminIcon from "./AdminIcon";
import AdminLoginPage from "./AdminLoginPage";

const mainLinks: { to: string; label: string; icon: AdminIconName; end?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: "overview", end: true },
  { to: "/admin/directory", label: "Directory", icon: "directory" },
];

const manageLinks: { to: string; label: string; icon: AdminIconName; kind?: string; faculty?: boolean }[] = [
  { to: "/admin/buildings", label: "Buildings", icon: "building", kind: "building" },
  { to: "/admin/rooms", label: "Rooms", icon: "rooms", kind: "room" },
  { to: "/admin/offices", label: "Offices", icon: "office", kind: "office" },
  { to: "/admin/colleges", label: "Colleges", icon: "college", kind: "college" },
  { to: "/admin/faculty", label: "Faculty", icon: "faculty", faculty: true },
  { to: "/admin/landmarks", label: "Landmarks", icon: "landmark", kind: "landmark" },
  { to: "/admin/campus-map", label: "Campus map", icon: "map" },
];

function AdminShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { places, faculties, userEmail, logout, refreshPlaces, refreshFaculty, isLoading, error, clearError } = useAdminData();
  const [search, setSearch] = useState("");
  const pageLinks = [...mainLinks, ...manageLinks, { to: "/admin/settings", label: "Settings", icon: "settings" as const }];
  const page = pageLinks.find((item) => item.to === pathname || (item.to !== "/admin" && pathname.startsWith(`${item.to}/`)));
  const pageTitle = page?.label ?? "Overview";

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    navigate(`/admin/directory?q=${encodeURIComponent(search.trim())}`);
  }

  function countFor(kind?: string) {
    if (!kind) return places.length;
    return places.filter((place) => place.kind === kind).length;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Logo />
          <span>Admin</span>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          <div className="admin-nav-group">
            {mainLinks.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}>
                <AdminIcon name={item.icon} />
                <span>{item.label}</span>
                {item.to === "/admin/directory" && <span className="admin-nav-count">{countFor()}</span>}
              </NavLink>
            ))}
          </div>

          <div className="admin-nav-label">Manage</div>
          <div className="admin-nav-group">
            {manageLinks.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}>
                <AdminIcon name={item.icon} />
                <span>{item.label}</span>
                {item.kind && <span className="admin-nav-count">{countFor(item.kind)}</span>}
                {item.faculty && <span className="admin-nav-count">{faculties.length}</span>}
              </NavLink>
            ))}
          </div>

          <div className="admin-nav-label">System</div>
          <NavLink to="/admin/settings" className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}>
            <AdminIcon name="settings" />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="admin-account">
          <div className="admin-avatar">AD</div>
          <div className="admin-account-details">
            <strong>Administrator</strong>
            <span title={userEmail}>{userEmail}</span>
            <small><i /> Connected to Supabase</small>
          </div>
          <button type="button" className="admin-signout" onClick={() => void logout()} title="Sign out" aria-label="Sign out">
            Sign out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>WayFinder Admin</span>
            <span className="admin-breadcrumb-separator">/</span>
            <strong>{pageTitle}</strong>
          </div>
          <form className="admin-global-search" onSubmit={submitSearch}>
            <AdminIcon name="search" size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search buildings, rooms, offices"
              aria-label="Search admin directory"
            />
          </form>
        </header>

        {error && (
          <div className="admin-connection-error" role="alert">
            <AdminIcon name="alert" size={17} />
            <span>{error}</span>
            <button type="button" onClick={() => { clearError(); void Promise.all([refreshPlaces(), refreshFaculty()]).catch(() => undefined); }}>Retry</button>
          </div>
        )}

        {isLoading && <div className="admin-loading-strip">Syncing directory records with Supabase…</div>}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminGate() {
  const { authState } = useAdminData();
  if (authState === "checking") {
    return <main className="admin-auth-loading"><span className="admin-spinner" /> Checking administrator session…</main>;
  }
  if (authState === "signed-out" || authState === "not-configured") return <AdminLoginPage />;
  return <AdminShell />;
}

export default function AdminLayout() {
  return (
    <AdminDataProvider>
      <AdminGate />
    </AdminDataProvider>
  );
}
