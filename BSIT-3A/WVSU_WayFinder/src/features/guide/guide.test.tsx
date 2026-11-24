import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

async function renderGuide(live: boolean, fetchImpl?: (url: string, init?: RequestInit) => unknown) {
  if (live) {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "sb_publishable_x");
  }
  if (fetchImpl) vi.stubGlobal("fetch", vi.fn(async (u: string, i?: RequestInit) => fetchImpl(u, i)));
  vi.resetModules();
  const { default: GuidePage } = await import("./GuidePage");
  render(<MemoryRouter><GuidePage /></MemoryRouter>);
}

describe("AI Guide", () => {
  it("grounded answer links to the cited place; the request carries only the publishable key", async () => {
    let body = "";
    let headers: Record<string, string> = {};
    await renderGuide(true, (url, init) => {
      if (String(url).includes("/functions/v1/ai-guide")) {
        body = String(init?.body);
        headers = init?.headers as Record<string, string>;
        return { ok: true, status: 200, json: async () => ({ answer: "Nasa Admin Building ito.", lang: "tl", grounded: true, citations: [{ type: "place", id: "office-registrar", label: "Office of the Registrar" }] }) };
      }
      return { ok: true, status: 200, json: async () => [] };
    });
    await userEvent.click(screen.getByRole("radio", { name: "Tagalog" }));
    await userEvent.click(screen.getByRole("button", { name: "Saan ang Registrar?" }));
    expect(await screen.findByText("Nasa Admin Building ito.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Office of the Registrar/ })).toHaveAttribute("href", "/map?to=office-registrar");
    expect(JSON.parse(body)).toEqual({ q: "Saan ang Registrar?", lang: "tl" });
    expect(headers.apikey).toBe("sb_publishable_x");
    expect(JSON.stringify(headers)).not.toMatch(/sk-ant|ANTHROPIC/i);
  });

  it("ungrounded answer → 'no verified information', no links", async () => {
    await renderGuide(true, () => ({ ok: true, status: 200, json: async () => ({ answer: "x", grounded: false, citations: [] }) }));
    await userEvent.type(screen.getByRole("textbox"), "What is the cafeteria menu?{Enter}");
    expect(await screen.findByText(/don’t have verified information/)).toBeInTheDocument();
  });

  it("provider unavailable (function 404) → labeled directory/process search instead", async () => {
    await renderGuide(true, (url) =>
      String(url).includes("ai-guide") ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => [] });
    await userEvent.type(screen.getByRole("textbox"), "Where is the Registrar?{Enter}");
    expect(await screen.findByText("Search results · not an AI answer")).toBeInTheDocument();
    expect(screen.getByText(/AI unavailable/)).toBeInTheDocument();
  });

  it("demo mode (no Supabase): fallback search finds demo places and processes, labeled Demo", async () => {
    await renderGuide(false);
    await userEvent.click(screen.getByRole("button", { name: "How do I process my clearance?" }));
    expect(await screen.findByRole("link", { name: /Demo Clearance/ })).toHaveAttribute("href", "/processes/proc-demo-clearance");
    expect(screen.getAllByText("Demo").length).toBeGreaterThan(0);
  });

  it("fallback: a known room opens on the map; an unknown room in the same building offers no other room", async () => {
    await renderGuide(false);
    const box = screen.getByRole("textbox");
    await userEvent.type(box, "Where is ICT 201?{enter}");
    expect(await screen.findByRole("link", { name: /Demo Room ICT 201/ })).toHaveAttribute("href", "/map?to=room-demo-ict-201");
    await userEvent.clear(box);
    await userEvent.type(box, "Where is ICT 999?{enter}");
    expect(await screen.findAllByText(/No matching/i)).not.toHaveLength(0);
    // Only the first question's result: "ICT 999" did not pull in ICT 201 or ICT 101 by the fragment "ict".
    expect(screen.getAllByRole("link", { name: /Demo Room ICT/ })).toHaveLength(1);
  });

  it("Hiligaynon suggestions", async () => {
    await renderGuide(false);
    await userEvent.click(screen.getByRole("radio", { name: "Hiligaynon" }));
    expect(screen.getByRole("button", { name: "Diin ang Registrar?" })).toBeInTheDocument();
  });
});
