// @vitest-environment node
// The bulk blueprint draft (supabase/drafts/blueprint_rooms_draft.sql) on an isolated PGlite database, after
// the QH 1 pilot: applies cleanly, a second run adds nothing, and every confirmed room is complete.
import { PGlite } from "@electric-sql/pglite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const pngSize = (f: string) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

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
  await d.exec("grant select on all tables in schema public to anon, authenticated;");
  return d;
}
const counts = async (d: PGlite) => (await d.query(`select (select count(*)::int from places) p, (select count(*)::int from building_features) l,
  (select count(*)::int from floor_plans) f, (select count(*)::int from floor_plan_rooms) s`)).rows[0];

describe("bulk blueprint draft", () => {
  it("pilot then bulk, twice: no duplicates; annexes excluded; every confirmed room is complete and student-visible after publishing", async () => {
    const d = await db();
    const pilot = read("supabase/drafts/pilot_quezon_hall_qh1.sql");
    await d.exec(pilot.slice(pilot.indexOf("do $$"), pilot.indexOf("end $$;") + 7));
    const bulk = read("supabase/drafts/blueprint_rooms_draft.sql");
    expect(bulk).not.toMatch(/annex/i);
    await d.exec(bulk);
    const first = await counts(d);
    await d.exec(bulk);
    expect(await counts(d)).toEqual(first);
    expect(first).toMatchObject({ f: 18 });

    // Every building has a map point (its MapTiler polygon centroid), so cards never say "Location unconfirmed".
    expect((await d.query(`select count(*)::int n from places where kind = 'building' and (lng is null or lat is null)`)).rows).toEqual([{ n: 0 }]);
    // QH 1 from the pilot and from the bulk draft is the same row, not two.
    expect((await d.query(`select count(*)::int n from places where room_code = 'QH1'`)).rows).toEqual([{ n: 1 }]);

    const rooms = (await d.query<{ id: string; label: string; floor: number; b: string; image_url: string; width_px: number; height_px: number; x: number; y: number; w: number; h: number }>(
      `select p.id, p.room_label label, p.floor, b.name b, f.image_url, f.width_px, f.height_px, s.x, s.y, s.w, s.h
       from places p join places b on b.id = p.parent_id join floor_plan_rooms s on s.place_id = p.id join floor_plans f on f.id = s.floor_plan_id
       where f.building_id = b.id and f.floor = p.floor`)).rows;
    expect(rooms.length).toBeGreaterThan(200);
    for (const r of rooms) {
      const file = join(process.cwd(), "data-intake/floor-plan-images", r.image_url.replace(/^floor-plans\//, ""));
      expect(existsSync(file), `${r.label}: ${r.image_url}`).toBe(true);
      expect(pngSize(file), `${r.label}: image size`).toEqual([r.width_px, r.height_px]);
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1.001 && r.y + r.h <= 1.001, `${r.label}: highlight inside the image`).toBe(true);
    }
    // Every highlight belongs to its room's own building and floor (none attached to another floor's image).
    expect((await d.query(`select count(*)::int n from floor_plan_rooms s join places p on p.id = s.place_id join floor_plans f on f.id = s.floor_plan_id
      where f.building_id <> p.parent_id or f.floor <> p.floor`)).rows).toEqual([{ n: 0 }]);

    // Nothing is visible to students before publishing; after a (local-only) publish, exactly these rows are.
    await d.exec("set role anon");
    expect((await d.query("select count(*)::int n from floor_plan_rooms")).rows).toEqual([{ n: 0 }]);
    await d.exec("reset role");
    await d.exec(`update places set status = 'verified', verified_by = 'local test', verified_at = now() where status = 'unverified';
      update building_features set status = 'verified'; update floor_plans set status = 'verified'; update floor_plan_rooms set status = 'verified';`);
    await d.exec("set role anon");
    expect((await d.query("select count(*)::int n from floor_plan_rooms")).rows).toEqual([{ n: first.s }]);
    await d.exec("reset role");
  });
});
