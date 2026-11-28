import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "./LegacyApp";

/** Renders the legacy (pre-redesign) app (all routes) at `url`; exposes the current location for assertions. */
export function renderApp(url = "/") {
  const loc = { current: "" };
  function Spy() {
    const l = useLocation();
    loc.current = l.pathname + l.search;
    return null;
  }
  render(<MemoryRouter initialEntries={[url]}><App /><Spy /></MemoryRouter>);
  return loc;
}
