
import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import HomePage from "./features/home/HomePage";
import SearchPage from "./features/search/SearchPage";
import MapPage from "./features/map/MapPage";
import DirectoryPage from "./features/directory/DirectoryPage";
import PlaceDetailPage from "./features/directory/PlaceDetailPage";
import FacultyDetailPage from "./features/directory/FacultyDetailPage";
import SchedulePage from "./features/schedule/SchedulePage";
import ClassFormPage from "./features/schedule/ClassFormPage";
import ProcessListPage from "./features/processes/ProcessListPage";
import ProcessDetailPage from "./features/processes/ProcessDetailPage";
import GuidePage from "./features/guide/GuidePage";
import NotFound from "./features/placeholders/NotFound";
import ReminderHost from "./features/schedule/ReminderHost";

// Admin Dashboard
import AdminLayout from "./admin/components/AdminLayout";
import OverviewPage from "./admin/pages/OverviewPage";
import AdminDirectoryPage from "./admin/pages/DirectoryPage";
import CategoryPage from "./admin/pages/CategoryPage";
import CampusMapPage from "./admin/pages/CampusMapPage";
import FacultyPage from "./admin/pages/FacultyPage";
import SettingsPage from "./admin/pages/SettingsPage";
import "./admin/admin.css";

export default function App() {
  return (
    <>
      <ReminderHost />

      <Routes>
        {/* ADMIN APPLICATION */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="overview" element={<OverviewPage />} />

          <Route
            path="directory"
            element={<AdminDirectoryPage />}
          />

          <Route
            path="buildings"
            element={
              <CategoryPage
                kind="building"
                description="Manage campus buildings and their directory details."
              />
            }
          />

          <Route
            path="rooms"
            element={
              <CategoryPage
                kind="room"
                description="Manage room names, room codes, floors, and building assignments."
              />
            }
          />

          <Route
            path="offices"
            element={
              <CategoryPage
                kind="office"
                description="Manage offices and their campus locations."
              />
            }
          />

          <Route
            path="colleges"
            element={
              <CategoryPage
                kind="college"
                description="Manage colleges and their home-building information."
              />
            }
          />

          <Route
            path="faculty"
            element={<FacultyPage />}
          />

          <Route
            path="landmarks"
            element={
              <CategoryPage
                kind="landmark"
                description="Manage campus landmarks students can search for."
              />
            }
          />

          <Route
            path="campus-map"
            element={<CampusMapPage />}
          />

          <Route
            path="settings"
            element={<SettingsPage />}
          />

          <Route
            path="*"
            element={<Navigate to="/admin" replace />}
          />
        </Route>

        {/* EXISTING STUDENT APPLICATION */}
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />

          <Route path="search" element={<SearchPage />} />

          <Route path="schedule" element={<SchedulePage />} />
          <Route path="schedule/new" element={<ClassFormPage />} />
          <Route path="schedule/:classId" element={<ClassFormPage />} />

          <Route path="map" element={<MapPage />} />

          <Route path="processes" element={<ProcessListPage />} />
          <Route
            path="processes/:processId"
            element={<ProcessDetailPage />}
          />

          <Route path="directory" element={<DirectoryPage />}>
            <Route
              path="faculty/:recordId"
              element={<FacultyDetailPage />}
            />
            <Route
              path=":placeId"
              element={<PlaceDetailPage />}
            />
          </Route>

          <Route path="guide" element={<GuidePage />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}