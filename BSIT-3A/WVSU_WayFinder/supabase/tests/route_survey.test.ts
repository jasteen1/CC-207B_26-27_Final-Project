// @vitest-environment node
// Route survey → draft SQL → (pilot + route) in PGlite → read back as a student → the app's trip planner.
// The survey coordinates here are TEST-ONLY samples near the real polygons, not surveyed points.
import { PGlite } from "@electric-sql/pglite";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
// Each test builds a fresh Postgres with all migrations; under a full parallel run that can exceed the defaults.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
import { planTrip } from "../../src/lib/trip/plan";
import type { CampusPaths, Place, PlaceView } from "../../src/lib/types";

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const uncomment = (sql: string, from: string) => sql.slice(sql.indexOf(from)).split("\n").filter((l) => l.startsWith("-- update")).map((l) => l.slice(3)).join("\n").replace("<reviewer>", "test");
const pilot = read("supabase/drafts/pilot_quezon_hall_qh1.sql");
const HEADER = "seq,point_id,role,name,lat,lng,gps_accuracy_m,readings,photo_filename,surveyed_by,surveyed_on,notes\n";
const SAMPLE = HEADER + [
  "1,gate-main,start,Main Gate (inside the gate),10.714640,122.563180,4,3,,test,2026-11-25,TEST-ONLY sample",
  "2,j-gate-road,junction,,10.714250,122.563000,5,3,,test,2026-11-25,",
  "3,j-main-road-quezon,junction,,10.713700,122.562800,5,3,,test,2026-11-25,",
  "4,qh-entrance-main,entrance,Quezon Hall main entrance,10.713330,122.562700,4,3,,test,2026-11-25,"].join("\n") + "\n";

function convert(csvText: string, name: string) {
  const dir = mkdtempSync(join(tmpdir(), "wf-route-"));
  writeFileSync(join(dir, `route-survey-${name}.csv`), csvText);
  const out = join(dir, `${name}.sql`);
  execFileSync("python3", ["-I", "scripts/route_survey_to_sql.py", join(dir, `route-survey-${name}.csv`), "--out", out]);
  return readFileSync(out, "utf8");
}

async function campus(withRoute: boolean) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role; create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$; create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id serial primary key, bucket_id text, name text); alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;`);
  for (const f of ["0001_places", "0002_faculty", "0003_schedule", "0004_processes", "0005_campus_paths", "0006_building_features", "0007_rooms_on_blueprints"])
    await db.exec(read(`supabase/migrations/${f}.sql`));
  await db.exec("grant select on all tables in schema public to anon, authenticated;");
  await db.exec(pilot.slice(pilot.indexOf("do $$"), pilot.indexOf("end $$;") + 7));
  await db.exec(pilot.slice(pilot.indexOf("-- begin;")).split("\n").filter((l) => l.startsWith("-- ")).map((l) => l.slice(3)).filter((l) => !/^(Replace|Makes|their status)/.test(l)).join("\n").replace("<reviewer>", "test"));
  // A building whose entrance sits on a walkway that reaches nothing (the disconnected start).
  await db.exec(`insert into places (id, kind, name, lng, lat, status) values ('bldg-coop', 'building', 'Coop Building', 122.561084, 10.712793, 'verified');
    insert into walk_nodes values ('n-coop', 122.5611, 10.71285, 'verified'); insert into entrances values ('ent-coop', 'bldg-coop', 'Coop entrance', 122.5611, 10.71285, 'n-coop', 'verified');`);
  if (withRoute) { const sql = convert(SAMPLE, "main-gate-to-quezon-hall"); await db.exec(sql); await db.exec(sql); await db.exec(uncomment(sql, "-- Publish")); }
  await db.exec("set role anon");
  const q = async <T,>(s: string) => (await db.query<T>(s)).rows;
  const places = await q<Record<string, unknown>>("select * from places");
  const P = (r: Record<string, unknown>): Place => ({ id: r.id as string, kind: r.kind as Place["kind"], name: r.name as string, roomCode: (r.room_code as string) ?? undefined,
    roomLabel: (r.room_label as string) ?? undefined, floor: (r.floor as number) ?? undefined, parentId: (r.parent_id as string) ?? undefined,
    lng: (r.lng as number) ?? undefined, lat: (r.lat as number) ?? undefined, status: r.status as Place["status"] });
  const byId = new Map(places.map((r) => [r.id as string, P(r)]));
  const view = (id: string): PlaceView => { const p = byId.get(id)!; return { place: p, parent: p.parentId ? byId.get(p.parentId) : undefined }; };
  const paths: CampusPaths = {
    nodes: await q("select id, lng, lat from walk_nodes"),
    edges: (await q<{ id: string; from_node: string; to_node: string; length_m: number | null }>("select * from walk_edges")).map((e) => ({ id: e.id, from: e.from_node, to: e.to_node, lengthM: e.length_m ?? undefined })),
    entrances: (await q<{ id: string; building_id: string; name: string; lng: number; lat: number; node_id: string }>("select * from entrances")).map((e) => ({ id: e.id, buildingId: e.building_id, name: e.name, lng: e.lng, lat: e.lat, nodeId: e.node_id })),
    floorPlans: (await q<{ id: string; building_id: string; floor: number; label: string; image_url: string }>("select * from floor_plans")).map((f) => ({ id: f.id, buildingId: f.building_id, floor: f.floor, label: f.label, imageUrl: f.image_url })),
    roomSpots: (await q<{ id: string; floor_plan_id: string; place_id: string; label: string; x: number; y: number; w: number; h: number }>("select * from floor_plan_rooms")).map((s) => ({ id: s.id, floorPlanId: s.floor_plan_id, placeId: s.place_id, label: s.label, shape: "rect" as const, x: s.x, y: s.y, w: s.w, h: s.h })),
  };
  return { db, paths, view, qh1: { kind: "place" as const, view: view("room-quezon-hall-f1-qh1") } };
}

describe("route survey: Main Gate → Quezon Hall", () => {
  it("rejects a blank or bad survey instead of guessing", () => {
    expect(() => convert(HEADER + "1,gate-main,start,Gate,,,,,,,,\n", "blank")).toThrow();
    expect(() => convert(SAMPLE.replace("10.713700,122.562800,5", "10.713700,122.562800,25"), "inaccurate")).toThrow();
    expect(() => convert(SAMPLE.replace("10.714250,122.563000", "122.563000,10.714250"), "swapped")).toThrow();
  });

  it("before the route is published: QH 1 still opens with its floor plan, and directions say why they're unavailable", async () => {
    const { paths, view, qh1 } = await campus(false);
    const t = planTrip(qh1, { kind: "none" }, paths);
    expect(t.status).toBe("no-entrance");
    expect(t.message).toMatch(/No verified entrance is recorded for Quezon Hall yet, so walking directions are unavailable/);
    expect(t.indoor?.spot?.label).toBe("QH 1");
    expect(view("room-quezon-hall-f1-qh1").parent?.name).toBe("Quezon Hall");
  });

  it("published route: manual start, usable GPS, inaccurate GPS, denied GPS, same building, disconnected start", async () => {
    const { db, paths, view, qh1 } = await campus(true);
    // Running the SQL twice added nothing; the route is 4 nodes / 3 segments.
    await db.exec("reset role");
    expect((await db.query("select (select count(*)::int from walk_edges) e, (select count(*)::int from walk_nodes) n")).rows).toEqual([{ e: 3, n: 5 }]);

    const manual = planTrip(qh1, { kind: "place", view: view("landmark-entrance-main-gate") }, paths);
    expect(manual.status).toBe("route");
    expect(manual.route?.nodeIds).toEqual(["n-gate-main", "n-j-gate-road", "n-j-main-road-quezon", "n-qh-entrance-main"]);
    expect(manual.entrance?.name).toBe("Quezon Hall main entrance");
    expect(manual.indoor?.spot?.label).toBe("QH 1");

    const gps = planTrip(qh1, { kind: "gps", fix: { lat: 10.71426, lng: 122.56301, accuracy: 8 } }, paths);
    expect(gps.status).toBe("route");
    expect(gps.route?.nodeIds[0]).toBe("n-j-gate-road");

    expect(planTrip(qh1, { kind: "gps", fix: { lat: 10.71426, lng: 122.56301, accuracy: 80 } }, paths).status).toBe("gps-poor");
    const denied = planTrip(qh1, { kind: "gps", fix: null, failure: "denied" }, paths);
    expect(denied.status).toBe("gps-failed");
    expect(denied.indoor?.spot?.label).toBe("QH 1");
    expect(planTrip(qh1, { kind: "place", view: view("bldg-quezon-hall") }, paths).status).toBe("same-building");
    const cut = planTrip(qh1, { kind: "place", view: view("bldg-coop") }, paths);
    expect(cut.status).toBe("no-path");
    expect(cut.message).toMatch(/Walking directions are unavailable/);
    expect(cut.indoor?.spot?.label).toBe("QH 1");
  });

  it("a second survey through the same junction reuses the shared segment", async () => {
    const first = convert(SAMPLE, "a");
    const second = convert(HEADER + [
      "1,j-gate-road,start,Gate road,10.714250,122.563000,5,3,,t,2026-11-25,",
      "2,j-main-road-quezon,junction,,10.713700,122.562800,5,3,,t,2026-11-25,",
      "3,lib-entrance,entrance,Library entrance,10.713900,122.561800,5,3,,t,2026-11-25,"].join("\n") + "\n", "b");
    const shared = "w-j-gate-road--j-main-road-quezon";
    expect(first).toContain(`'${shared}'`);
    expect(second).toContain(`'${shared}'`);
  });
});
