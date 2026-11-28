import { Route, Routes } from "react-router-dom";
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

export default function LegacyApp() {
  return (
    <>
      <ReminderHost />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="schedule/new" element={<ClassFormPage />} />
          <Route path="schedule/:classId" element={<ClassFormPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="processes" element={<ProcessListPage />} />
          <Route path="processes/:processId" element={<ProcessDetailPage />} />
          <Route path="directory" element={<DirectoryPage />}>
            <Route path="faculty/:recordId" element={<FacultyDetailPage />} />
            <Route path=":placeId" element={<PlaceDetailPage />} />
          </Route>
          <Route path="guide" element={<GuidePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
