// @vitest-environment node
// Applies 0001-0007 in an in-process Postgres (PGlite) with stand-ins for Supabase's auth/storage
// schemas, then checks the access rules. This proves the SQL, not that it is applied to the live project.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
// Each test builds a fresh Postgres with all migrations; under a full parallel run that can exceed the defaults.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const sql = (f: string) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8");
let db: PGlite;
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id serial primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    grant usage on schema storage to authenticated; grant all on storage.objects to authenticated; grant usage, select on all sequences in schema storage to authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  for (const f of ["0001_places.sql", "0002_faculty.sql", "0003_schedule.sql", "0004_processes.sql", "0005_campus_paths.sql", "0006_building_features.sql", "0007_rooms_on_blueprints.sql"]) await db.exec(sql(f));
  await db.exec(`grant select on public.places to anon, authenticated;`);
  await db.exec(`
    insert into places (id, kind, name, status, source, verified_by, verified_at) values ('office-reg', 'office', 'Registrar', 'verified', 's', 'v', now());
    insert into processes (id, name, is_published, status, source, verified_by, verified_at) values
      ('p-pub', 'Published', true, 'verified', 's', 'v', now()), ('p-draft', 'Draft', false, 'verified', 's', 'v', now());
    insert into processes (id, name, is_published, status) values ('p-unv', 'Unverified', true, 'unverified');
    insert into process_steps values ('p-pub', 1, 'office-reg', 'Registrar', 'Submit'), ('p-draft', 1, 'office-reg', 'Registrar', 'Secret');
    insert into walk_nodes values ('n1', 1, 1, 'verified'), ('n2', 1, 2, 'unverified');
    insert into places (id, kind, name, status, description) values ('bldg-lib', 'building', 'Library', 'verified', 'Main library');
    insert into building_features values (21, 'bldg-lib', 'verified'), (33, 'bldg-lib', 'verified'), (20, 'bldg-lib', 'unverified');
  `);
});

async function as<T>(role: string, uid: string | null, q: string) {
  await db.exec(`set role ${role}; select set_config('test.uid', '${uid ?? ""}', false);`);
  try { return (await db.query<T>(q)).rows; } finally { await db.exec("reset role"); }
}

describe("processes", () => {
  it("students see only published + verified guides and their steps", async () => {
    expect(await as<{ id: string }>("anon", null, "select id from processes order by id")).toEqual([{ id: "p-pub" }]);
    expect(await as<{ action: string }>("anon", null, "select action from process_steps")).toEqual([{ action: "Submit" }]);
  });
  it("a verified guide needs a source", async () => {
    await expect(db.exec("insert into processes (id, name, status) values ('x', 'x', 'verified')")).rejects.toThrow(/processes_verified_requires_source/);
  });
});

describe("walkways", () => {
  it("only verified nodes are readable", async () => {
    expect(await as<{ id: string }>("anon", null, "select id from walk_nodes")).toEqual([{ id: "n1" }]);
  });
});

describe("building features (map polygons → places)", () => {
  it("students read only verified links; one place can own several polygons", async () => {
    expect(await as<{ feature_id: number }>("anon", null, "select feature_id from building_features order by feature_id")).toEqual([{ feature_id: 21 }, { feature_id: 33 }]);
    expect(await as<{ description: string }>("anon", null, "select description from places where id = 'bldg-lib'")).toEqual([{ description: "Main library" }]);
  });
  it("a polygon links to at most one place, and only to a real place", async () => {
    await expect(db.exec("insert into building_features values (21, 'office-reg', 'verified')")).rejects.toThrow(/duplicate key/);
    await expect(db.exec("insert into building_features values (99, 'nope', 'verified')")).rejects.toThrow(/foreign key/);
  });
});

describe("private schedules", () => {
  it("each student sees only their own classes; anon sees nothing", async () => {
    await as("authenticated", A, "insert into class_sessions (subject, weekday, start_time, end_time, room_code_raw) values ('Mine', 1, '08:00', '09:00', 'CB 203')");
    await as("authenticated", B, "insert into class_sessions (subject, weekday, start_time, end_time, room_code_raw) values ('Theirs', 2, '10:00', '11:00', 'GYM-X')");
    expect(await as<{ subject: string }>("authenticated", A, "select subject from class_sessions")).toEqual([{ subject: "Mine" }]);
    await expect(as("anon", null, "select * from class_sessions")).rejects.toThrow(/permission denied/);
  });
  it("can't write a row for someone else, and times are Asia/Manila only", async () => {
    await expect(as("authenticated", A, `insert into class_sessions (user_id, subject, weekday, start_time, end_time, room_code_raw) values ('${B}', 'x', 1, '08:00', '09:00', 'x')`)).rejects.toThrow(/row-level security/);
    await expect(as("authenticated", A, "insert into class_sessions (subject, weekday, start_time, end_time, room_code_raw, tz) values ('x', 1, '08:00', '09:00', 'x', 'UTC')")).rejects.toThrow(/check/);
  });
  it("0007: room spots are fractions of the image, readable only when verified; prefixes are upper-case letters", async () => {
    await db.exec(`
      insert into places (id, kind, name, status) values ('bldg-cict', 'building', 'CICT Building', 'verified');
      insert into places (id, kind, name, room_code, room_label, floor, parent_id, status) values ('room-ict-201', 'room', 'ICT 201', 'ICT201', 'ICT 201', 2, 'bldg-cict', 'verified');
      insert into floor_plans (id, building_id, floor, image_url, width_px, height_px, status) values ('fp-cict-2', 'bldg-cict', 2, 'https://x/p.png', 1600, 900, 'verified');
      insert into floor_plan_rooms (id, floor_plan_id, place_id, label, shape, x, y, w, h, status) values
        ('s1', 'fp-cict-2', 'room-ict-201', 'ICT 201', 'rect', .1, .2, .15, .1, 'verified'),
        ('s2', 'fp-cict-2', 'room-ict-201', 'ICT 201?', 'marker', .5, .5, null, null, 'unverified');
      insert into room_code_prefixes (prefix, building_id, map_name, status) values ('ICT', 'bldg-cict', 'CICT Building', 'verified');
    `);
    expect(await as("anon", null, "select id from floor_plan_rooms")).toEqual([{ id: "s1" }]);
    expect(await as("anon", null, "select room_label from places where id = 'room-ict-201'")).toEqual([{ room_label: "ICT 201" }]);
    await expect(db.exec("insert into floor_plan_rooms (id, floor_plan_id, place_id, label, shape, x, y, w, h) values ('bad', 'fp-cict-2', 'room-ict-201', 'x', 'rect', 1.5, .2, .1, .1)")).rejects.toThrow(/check/);
    await expect(db.exec("insert into floor_plan_rooms (id, floor_plan_id, place_id, label, shape, x, y) values ('bad2', 'fp-cict-2', 'room-ict-201', 'x', 'rect', .1, .2)")).rejects.toThrow(/check/);
    await expect(db.exec("insert into room_code_prefixes (prefix) values ('ict')")).rejects.toThrow(/check/);
    await expect(as("anon", null, "insert into room_code_prefixes (prefix) values ('ZZ')")).rejects.toThrow(/permission denied|row-level security/);
  });
  it("schedule images: only inside the owner's folder", async () => {
    await as("authenticated", A, `insert into storage.objects (bucket_id, name) values ('schedule-images', '${A}/t.jpg')`);
    await expect(as("authenticated", A, `insert into storage.objects (bucket_id, name) values ('schedule-images', '${B}/t.jpg')`)).rejects.toThrow(/row-level security/);
    expect(await as("authenticated", B, "select name from storage.objects")).toEqual([]);
  });
});
