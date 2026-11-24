// @vitest-environment node
// The QH 1 pilot (supabase/drafts/pilot_quezon_hall_qh1.sql) against 0001-0007 in PGlite. Proves the SQL
// and the publication rules, not that anything is applied to the live project.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
// Each test builds a fresh Postgres with all migrations; under a full parallel run that can exceed the defaults.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const pilot = read("supabase/drafts/pilot_quezon_hall_qh1.sql");
const partA = pilot.slice(pilot.indexOf("-- ======================= PART A"), pilot.indexOf("-- ======================= PART B"));
const partB = pilot.slice(pilot.indexOf("do $$"), pilot.indexOf("end $$;") + 7);
/** Part C ships commented out; uncomment it the way the reviewer would. */
const partC = pilot.slice(pilot.indexOf("-- begin;")).split("\n").filter((l) => l.startsWith("-- ")).map((l) => l.slice(3))
  .filter((l) => !/^(Replace|Makes|their status)/.test(l)).join("\n").replace("<reviewer>", "pilot reviewer");

async function db() {
  const d = new PGlite();
  await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role; create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$; create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id serial primary key, bucket_id text, name text); alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;`);
  for (const f of ["0001_places", "0002_faculty", "0003_schedule", "0004_processes", "0005_campus_paths", "0006_building_features", "0007_rooms_on_blueprints"])
    await d.exec(read(`supabase/migrations/${f}.sql`));
  await d.exec("grant select on public.places to anon, authenticated;");
  return d;
}
const asStudent = async (d: PGlite, q: string) => { await d.exec("set role anon"); try { return (await d.query(q)).rows; } finally { await d.exec("reset role"); } };
const STUDENT_VIEW = `select p.room_label, p.floor, b.name as building, f.image_url, f.width_px, f.height_px, s.x, s.y, s.w, s.h
  from places p join places b on b.id = p.parent_id join floor_plan_rooms s on s.place_id = p.id join floor_plans f on f.id = s.floor_plan_id
  where p.room_code = 'QH1'`;

describe("QH 1 pilot", () => {
  it("Part A is read-only and runs before anything exists", async () => {
    const d = await db();
    await d.exec(partA);
    expect((await d.query("select count(*)::int n from places")).rows).toEqual([{ n: 0 }]);
  });

  it("Part B (twice) writes 5 unverified rows students can't see; Part C publishes exactly those", async () => {
    const d = await db();
    await d.exec(partB); await d.exec(partB);
    expect((await d.query(`select (select count(*)::int from places) p, (select count(*)::int from building_features) l,
      (select count(*)::int from floor_plans) f, (select count(*)::int from floor_plan_rooms) s`)).rows).toEqual([{ p: 2, l: 1, f: 1, s: 1 }]);
    expect(await asStudent(d, STUDENT_VIEW)).toEqual([]);
    await d.exec(partC);
    expect(await asStudent(d, STUDENT_VIEW)).toEqual([{ room_label: "QH 1", floor: 1, building: "Quezon Hall",
      image_url: "floor-plans/quezon-hall-floor-1.png", width_px: 1544, height_px: 580, x: 0.2157, y: 0.0207, w: 0.0997, h: 0.5138 }]);
    expect(await asStudent(d, "select feature_id, place_id from building_features")).toEqual([{ feature_id: 10, place_id: "bldg-quezon-hall" }]);
    expect(await asStudent(d, "select lng, lat from places where id = 'bldg-quezon-hall'")).toEqual([{ lng: 122.562676, lat: 10.71313 }]);
    // QH 2 and everything else stay unpublished (there is nothing else).
    expect(await asStudent(d, "select count(*)::int n from places")).toEqual([{ n: 2 }]);
  });

  it("an existing VERIFIED Quezon Hall is reused and keeps its status, reviewer and data", async () => {
    const d = await db();
    await d.exec(`insert into places (id, kind, name, short_name, status, verified_by, verified_at) values ('bldg-qh', 'building', 'Quezon Hall', 'QH', 'verified', 'registrar', '2026-01-01')`);
    await d.exec(partB); await d.exec(partC);
    expect((await d.query(`select id, short_name, status, verified_by, verified_at::date::text d from places where kind = 'building'`)).rows)
      .toEqual([{ id: "bldg-qh", short_name: "QH", status: "verified", verified_by: "registrar", d: "2026-01-01" }]);
    expect((await d.query(`select parent_id, status, verified_by from places where room_code = 'QH1'`)).rows).toEqual([{ parent_id: "bldg-qh", status: "verified", verified_by: "pilot reviewer" }]);
  });

  it("a verified highlight is never moved by Part B", async () => {
    const d = await db();
    await d.exec(partB); await d.exec(partC);
    await d.exec(`update floor_plan_rooms set x = 0.3 where id = 'spot-room-quezon-hall-f1-qh1'`);
    await d.exec(partB);
    expect((await d.query(`select x from floor_plan_rooms`)).rows).toEqual([{ x: 0.3 }]);
  });

  it("stops instead of attaching QH 1's coordinates to a different floor 1 image", async () => {
    const d = await db();
    await d.exec(`insert into places (id, kind, name, status) values ('bldg-quezon-hall', 'building', 'Quezon Hall', 'unverified');
      insert into floor_plans (id, building_id, floor, image_url, status) values ('fp-old', 'bldg-quezon-hall', 1, 'https://x/old-scan.jpg', 'verified')`);
    await expect(d.exec(partB)).rejects.toThrow(/different image/);
    expect((await d.query("select count(*)::int n from floor_plan_rooms")).rows).toEqual([{ n: 0 }]);
  });
});
