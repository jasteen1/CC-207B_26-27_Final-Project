// @vitest-environment node
// Applies migrations 0001-0008 and supabase/seed/room_directory.sql to an in-process Postgres (PGlite),
// then reads the directory the way the app does (anon role, through RLS). Proves the SQL and the data,
// not that it has been applied to the live project.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const root = process.cwd();
const migrations = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
const seed = readFileSync(join(root, "supabase/seed/room_directory.sql"), "utf8");
const csvRows = ["room-labels.csv", "room-labels-added.csv"]
  .flatMap((f) => readFileSync(join(root, "data-intake", f), "utf8").trim().split("\n").slice(1));
let db: PGlite;

async function freshDb(drafts: string[] = []) {
  const d = new PGlite();
  await d.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id serial primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
  `);
  for (const f of migrations) await d.exec(readFileSync(join(root, "supabase/migrations", f), "utf8"));
  // The publish draft refuses to run until a reviewer is named; name a test one.
  for (const f of drafts) await d.exec(readFileSync(join(root, "supabase/drafts", f), "utf8").replace("'<REVIEWER NAME>'::text", "'test reviewer'::text"));
  await d.exec(seed);
  return d;
}

beforeAll(async () => { db = await freshDb(); }, 60_000);

async function anon<T>(q: string) {
  await db.exec("set role anon");
  try { return (await db.query<T>(q)).rows; } finally { await db.exec("reset role"); }
}

describe("room directory seed", () => {
  it("loads every transcribed room and office", async () => {
    const [{ n }] = (await db.query<{ n: number }>("select count(*)::int n from places where kind in ('room','office')")).rows;
    expect(n).toBe(csvRows.length);
    expect(n).toBeGreaterThanOrEqual(424);
  });

  it("every room belongs to a building", async () => {
    const orphans = (await db.query("select r.id from places r left join places b on b.id = r.parent_id and b.kind = 'building' where r.kind in ('room','office') and b.id is null")).rows;
    expect(orphans).toEqual([]);
  });

  it("the public (anon) directory view returns all of it", async () => {
    const rows = await anon<{ id: string }>("select id from room_directory");
    expect(rows.length).toBe(csvRows.length);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it("looks a room up by its door code", async () => {
    const hit = async (code: string) => (await anon<{ building_name: string; floor: number; name: string }>(
      `select building_name, floor, name from room_directory where room_code = '${code}'`))[0];
    expect(await hit("NAB201")).toMatchObject({ building_name: "New Academic Building", floor: 2 });
    expect(await hit("RH103")).toMatchObject({ building_name: "Rizal Hall", floor: 1 });
    expect(await hit("ICT201")).toMatchObject({ building_name: "CICT Building" });
    expect(await hit("EB205")).toMatchObject({ building_name: "COP Building (College of PESCAR)", floor: 2 });
    expect(await hit("QH1")).toMatchObject({ building_name: "Quezon Hall" });
  });

  it("positioned rooms carry a floor plan and a box inside it", async () => {
    const rows = await anon<{ x: number; y: number; w: number; h: number; floor_plan_url: string }>("select x, y, w, h, floor_plan_url from room_directory where x is not null");
    expect(rows.length).toBeGreaterThan(400);
    for (const r of rows) {
      expect(r.floor_plan_url).toMatch(/floor-plans\/[a-z0-9-]+\.png$/);
      expect(r.x + r.w).toBeLessThanOrEqual(1.0001);
      expect(r.y + r.h).toBeLessThanOrEqual(1.0001);
    }
  });

  it("covers every building with a blueprint", async () => {
    const rows = await anon<{ building_name: string; n: number }>("select building_name, count(*)::int n from room_directory group by 1 order by 1");
    expect(rows.length).toBe(20);
    expect(rows.every((r) => r.n > 0)).toBe(true);
  });

  it("re-running the seed changes nothing", async () => {
    await db.exec(seed);
    const [{ n }] = (await db.query<{ n: number }>("select count(*)::int n from places")).rows;
    expect(n).toBe(csvRows.length + 20);
  });

  it("unverified rows stay hidden from the app", async () => {
    await db.exec("insert into places (id, kind, name, parent_id, status) values ('room-hidden', 'room', 'Hidden', 'bldg-quezon-hall', 'unverified')");
    expect(await anon("select id from room_directory where id = 'room-hidden'")).toEqual([]);
  });
});

describe("on top of the earlier drafts (blueprint draft, QH 1 pilot, 18 floor plans)", () => {
  it("applies cleanly, reuses their ids and leaves one plan per building floor", async () => {
    const d = await freshDb(["blueprint_rooms_draft.sql", "pilot_quezon_hall_qh1.sql", "floor_plans_18_publish.sql"]);
    const dupPlans = (await d.query("select building_id, floor from floor_plans where floor is not null group by 1, 2 having count(*) > 1")).rows;
    expect(dupPlans).toEqual([]);
    const qh1 = (await d.query<{ id: string; status: string }>("select id, status from places where room_code = 'QH1'")).rows;
    expect(qh1).toEqual([{ id: "room-quezon-hall-f1-qh1", status: "verified" }]);
    const [{ n }] = (await d.query<{ n: number }>("select count(*)::int n from places where kind in ('room','office') and status = 'verified'")).rows;
    expect(n).toBe(csvRows.length);
  }, 60_000);
});
