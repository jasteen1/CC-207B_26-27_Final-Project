// @vitest-environment node
// Runs the real migrations in an in-process Postgres (PGlite) and checks the access rules.
// This is NOT a Supabase project: it proves the SQL applies and the RLS/column grants behave,
// not that anything has been applied to a live Supabase database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
// Builds a fresh Postgres with all migrations; under a full parallel run that can exceed the defaults.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const sql = (f: string) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8");
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  // Stand-ins for the roles Supabase provides.
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(sql("0001_places.sql"));
  await db.exec(`grant select on public.places to anon, authenticated; grant all on public.places to service_role;`);
  await db.exec(sql("0002_faculty.sql"));
  await db.exec(`
    insert into places (id, kind, name, lng, lat, status, source, verified_by, verified_at) values
      ('bldg-v', 'building', 'Verified Bldg', 122.5, 10.7, 'verified', 's', 'v', now()),
      ('room-v-mapped', 'room', 'Mapped Office', null, null, 'verified', 's', 'v', now()),
      ('room-unver', 'room', 'Unverified Office', 122.6, 10.8, 'unverified', null, null, null);
    update places set parent_id = 'bldg-v' where id = 'room-v-mapped';
    insert into faculty (full_name, office_id, official_email, office_hours, status, source, verified_by, verified_at) values
      ('Verified Teacher', 'room-v-mapped', 't@example.test', 'Mon 9-11', 'verified', 'dept memo', 'editor1', now()),
      ('Hidden Teacher', null, 'h@example.test', null, 'unverified', null, null, null);
  `);
});

async function as<T>(role: string, query: string) {
  await db.exec(`set role ${role}`);
  try {
    return (await db.query<T>(query)).rows;
  } finally {
    await db.exec("reset role");
  }
}

describe("faculty access rules", () => {
  it("both migrations apply in order", async () => {
    expect((await db.query("select count(*)::int n from faculty")).rows[0]).toEqual({ n: 2 });
  });

  it("anon sees verified faculty only, via the permitted columns", async () => {
    const rows = await as<{ full_name: string }>("anon", "select id, full_name, department, college_id, office_id, official_email, office_hours, verified_at from faculty");
    expect(rows.map((r) => r.full_name)).toEqual(["Verified Teacher"]);
  });

  it("anon can filter and sort on permitted columns", async () => {
    const rows = await as<{ full_name: string }>("anon", "select full_name from faculty where lower(full_name) like '%teacher%' order by full_name");
    expect(rows).toHaveLength(1);
  });

  it("anon cannot read verifier columns or use select *", async () => {
    await expect(as("anon", "select verified_by from faculty")).rejects.toThrow(/permission denied/);
    await expect(as("anon", "select source from faculty")).rejects.toThrow(/permission denied/);
    await expect(as("anon", "select * from faculty")).rejects.toThrow(/permission denied/);
  });

  it("anon cannot filter on status (the app must rely on RLS, not a status= URL filter)", async () => {
    await expect(as("anon", "select id from faculty where status = 'verified'")).rejects.toThrow(/permission denied/);
  });

  it("anon cannot write", async () => {
    await expect(as("anon", "insert into faculty (full_name) values ('x')")).rejects.toThrow(/permission denied/);
  });

  it("a verified row must carry source, verifier and date", async () => {
    await expect(db.exec("insert into faculty (full_name, status) values ('No Proof', 'verified')")).rejects.toThrow(/faculty_verified_requires_source/);
  });

  it("an unverified office is invisible to anon even when linked", async () => {
    await db.exec("update faculty set office_id = 'room-unver' where full_name = 'Hidden Teacher'");
    const rows = await as("anon", "select id from places where id = 'room-unver'");
    expect(rows).toEqual([]);
  });
});
