/* WVSU WayFinder: routes for the redesigned app (design source: ~/Downloads/WayFinder-SVGs). */
import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, type Location } from "react-router-dom";
import { StoreProvider, useWF } from "./wf/core";
import { Intro, Login, ProfileSetup, SigningIn, Welcome, WrongAccount } from "./wf/screens/Onboarding";
import { Home, Klass, Lock, Manual, Notifications, PushHost, Reading, Review, Scan, Schedule } from "./wf/screens/Schedule";
import { Blueprint, FloorView, MapHome, PinPicker, Place, RouteView, StartPicker, Stops } from "./wf/screens/Map";
import { AskSheet, Directory, Office, Process } from "./wf/screens/Directory";

/** Deep links into signed-in screens act signed in, like the prototype. */
function Signed({ children }: { children: ReactNode }) {
  const { S, set } = useWF();
  useEffect(() => { if (!S.signed) set((d) => { d.signed = true; }); }, [S.signed, set]);
  return <>{children}</>;
}
function Root() {
  const { S } = useWF();
  return <Navigate to={S.signed ? "/home" : "/welcome"} replace />;
}
function screenRoutes() {
  return (
    <>
      <Route path="/" element={<Root />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/intro" element={<Intro />} />
      <Route path="/login" element={<Login />} />
      <Route path="/google" element={<Login google />} />
      <Route path="/signing-in" element={<SigningIn />} />
      <Route path="/wrong-account" element={<WrongAccount />} />
      <Route path="/profile" element={<Signed><ProfileSetup /></Signed>} />
      <Route path="/home" element={<Signed><Home /></Signed>} />
      <Route path="/notifications" element={<Signed><Notifications /></Signed>} />
      <Route path="/lock" element={<Signed><Lock /></Signed>} />
      <Route path="/scan" element={<Signed><Scan /></Signed>} />
      <Route path="/scan/reading" element={<Signed><Reading /></Signed>} />
      <Route path="/scan/review" element={<Signed><Review /></Signed>} />
      <Route path="/manual" element={<Signed><Manual /></Signed>} />
      <Route path="/schedule" element={<Signed><Schedule /></Signed>} />
      <Route path="/class/:code/:mi" element={<Signed><Klass /></Signed>} />
      <Route path="/map" element={<MapHome />} />
      <Route path="/map/place/:id" element={<Place />} />
      <Route path="/map/floor/:id" element={<FloorView />} />
      <Route path="/map/blueprint/:id" element={<Blueprint />} />
      <Route path="/map/start" element={<StartPicker />} />
      <Route path="/map/pin" element={<PinPicker />} />
      <Route path="/map/route" element={<RouteView />} />
      <Route path="/map/stops" element={<Stops />} />
      <Route path="/directory" element={<Directory />} />
      <Route path="/directory/office/:id" element={<Office />} />
      <Route path="/directory/process/:id" element={<Process />} />
    </>
  );
}
/** Ask WayFinder opens as a sheet over the screen you came from (rendered at the top level, not nested). */
function Screens() {
  const loc = useLocation();
  const ask = /^\/ask(\/answer)?\/?$/.exec(loc.pathname);
  if (ask) {
    const back = (loc.state as { back?: string } | null)?.back || "/home";
    const [pathname, search = ""] = back.split("?");
    const under: Location = { ...loc, pathname, search: search ? `?${search}` : "", state: null, key: "ask-under" };
    return <Signed><AskSheet answer={!!ask[1]} under={<Routes location={under}>{screenRoutes()}</Routes>} /></Signed>;
  }
  return (
    <Routes>
      {screenRoutes()}
      <Route path="*" element={<Root />} />
    </Routes>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <div className="stage">
        <div className="phone" role="application" aria-label="WayFinder app">
          <div className="screen" id="app" aria-live="polite"><Screens /></div>
          <PushHost />
        </div>
      </div>
    </StoreProvider>
  );
}
