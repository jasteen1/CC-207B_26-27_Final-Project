-- PATCH: publish 18 floor plans across 8 buildings (map building + map link + floor plan).
-- NOT APPLIED. Prepared 2026-11-25 for review. Source values: supabase/drafts/blueprint_rooms_draft.sql.
-- Requires migrations 0005, 0006 and 0007 (floor_plans.width_px/height_px).
--
-- Scope, exactly: 8 building rows in public.places, their 8 rows in public.building_features, and 18 rows
-- in public.floor_plans. NOT included: rooms, offices, room highlights (floor_plan_rooms), College of
-- Communication, Center for Foreign Languages, Annex 1/3, College of Law, PESCAR, Research Buildings, SDG rooms.
--
-- All 18 images were uploaded to the public 'floor-plans' bucket and read back with matching SHA-256 on 2026-11-25.
--
-- Run in the Supabase SQL Editor (it sees unverified rows too), in this order:
--   PART 1  preflight (read-only). Expect no CONFLICT rows. Resolve any REVIEW rows.
--   PART 2  set the reviewer name, then run the transaction. Any conflict aborts it with nothing written.
--   PART 3  post-check (read-only). Expect 18 rows with ready = true.
--
-- Rules the transaction follows:
--   * Missing rows are inserted already verified. Existing 'unverified' rows that match are marked verified.
--   * Rows already 'verified' are never modified (fp-quezon-hall-1, bldg-quezon-hall and feature 10 today).
--   * Existing names and labels are kept. An empty width_px/height_px is filled on rows it verifies.
--   * It stops if an expected ID exists with another building, floor, image, size, kind or map target,
--     if another row already holds one of these building floors or images, if a building name is
--     duplicated under another ID, or if a row is a 'demo' row.
--   * Safe to re-run: a second run finds everything verified and changes nothing.


-- ============================ PART 1: preflight (read-only) ============================
with eb(id, name, feature_id, lng, lat, source) as (values
  ('bldg-quezon-hall', 'Quezon Hall', 10, 122.562676, 10.71313, 'blueprint quezon hall.png; map centroid'),
  ('bldg-hometel', 'Hometel', 11, 122.562861, 10.712854, 'blueprint hometel.png; map centroid'),
  ('bldg-college-of-dentistry', 'College of Dentistry', 14, 122.563568, 10.712278, 'blueprint college of dentistry.png; map centroid'),
  ('bldg-college-of-business-and-management', 'College of Business and Management', 15, 122.563924, 10.712069, 'blueprint college of business and management.png; map centroid'),
  ('bldg-cict-building', 'CICT Building', 19, 122.561602, 10.713152, 'blueprint college of information and communications technology.png; map centroid'),
  ('bldg-administration', 'Administration', 31, 122.561881, 10.714219, 'blueprint admin building.png; map centroid'),
  ('bldg-coop-building', 'Coop Building', 37, 122.561084, 10.712793, 'blueprint coop.png; map centroid'),
  ('bldg-college-of-medicine-roxas-hall', 'College of Medicine (Roxas Hall)', 38, 122.561815, 10.71286, 'blueprint roxas hall.png, roxas hall 2.png; map centroid')
), ef(id, building_id, floor, label, image_url, w, h) as (values
  ('fp-quezon-hall-1', 'bldg-quezon-hall', 1, '1st Floor', 'floor-plans/quezon-hall-floor-1.png', 1544, 580),
  ('fp-quezon-hall-2', 'bldg-quezon-hall', 2, '2nd Floor', 'floor-plans/quezon-hall-floor-2.png', 1544, 480),
  ('fp-hometel-1', 'bldg-hometel', 1, '1st floor', 'floor-plans/hometel-floor-1.png', 889, 460),
  ('fp-hometel-2', 'bldg-hometel', 2, '2nd floor', 'floor-plans/hometel-floor-2.png', 889, 420),
  ('fp-hometel-3', 'bldg-hometel', 3, '3rd floor', 'floor-plans/hometel-floor-3.png', 889, 420),
  ('fp-college-of-dentistry-1', 'bldg-college-of-dentistry', 1, '1st Floor', 'floor-plans/college-of-dentistry-floor-1.png', 997, 802),
  ('fp-college-of-dentistry-2', 'bldg-college-of-dentistry', 2, '2nd Floor', 'floor-plans/college-of-dentistry-floor-2.png', 997, 800),
  ('fp-college-of-business-and-management-1', 'bldg-college-of-business-and-management', 1, '1st Floor', 'floor-plans/college-of-business-and-management-floor-1.png', 1550, 630),
  ('fp-college-of-business-and-management-2', 'bldg-college-of-business-and-management', 2, '2nd Floor', 'floor-plans/college-of-business-and-management-floor-2.png', 1550, 640),
  ('fp-cict-building-1', 'bldg-cict-building', 1, 'FIRST FLOOR', 'floor-plans/cict-building-floor-1.png', 1135, 448),
  ('fp-cict-building-2', 'bldg-cict-building', 2, 'SECOND FLOOR', 'floor-plans/cict-building-floor-2.png', 1135, 445),
  ('fp-cict-building-3', 'bldg-cict-building', 3, 'THIRD FLOOR', 'floor-plans/cict-building-floor-3.png', 1135, 447),
  ('fp-administration-1', 'bldg-administration', 1, 'GROUND FLOOR', 'floor-plans/administration-floor-1.png', 1270, 640),
  ('fp-administration-2', 'bldg-administration', 2, 'SECOND FLOOR', 'floor-plans/administration-floor-2.png', 1270, 695),
  ('fp-coop-building-1', 'bldg-coop-building', 1, '1st Floor', 'floor-plans/coop-building-floor-1.png', 1065, 455),
  ('fp-coop-building-2', 'bldg-coop-building', 2, '2nd Floor', 'floor-plans/coop-building-floor-2.png', 1066, 382),
  ('fp-college-of-medicine-roxas-hall-1', 'bldg-college-of-medicine-roxas-hall', 1, 'ROXAS HALL 1st Floor', 'floor-plans/college-of-medicine-roxas-hall-floor-1.png', 1268, 1024),
  ('fp-college-of-medicine-roxas-hall-2', 'bldg-college-of-medicine-roxas-hall', 2, 'ROXAS HALL 2nd Floor', 'floor-plans/college-of-medicine-roxas-hall-floor-2.png', 1268, 1024)
)
select * from (
  -- 1. Buildings, by exact ID
  select 1 as ord, 'building' as object, eb.id as key, null::int as floor, p.status as current_status,
    case when p.id is null then 'MISSING: will insert as verified'
         when p.kind <> 'building' then 'CONFLICT: ' || eb.id || ' exists with kind ' || p.kind
         when p.status = 'demo' then 'CONFLICT: ' || eb.id || ' is a demo row'
         when lower(trim(p.name)) <> lower(eb.name) then 'REVIEW: name is "' || p.name || '", expected "' || eb.name || '" (name kept; '
              || case when p.status = 'verified' then 'already verified)' else 'will be marked verified)' end
         when p.status = 'verified' then 'ok: already verified, unchanged'
         else 'ok: will be marked verified' end as result
  from eb eb left join public.places p on p.id = eb.id
  union all
  -- 2. Another building record with the same name under a different ID (would be a duplicate building)
  select 2, 'building (duplicate name)', p.id, null, p.status,
    'CONFLICT: building ' || p.id || ' is also named "' || p.name || '"; expected only ' || eb.id
  from eb eb join public.places p on p.kind = 'building' and lower(trim(p.name)) = lower(eb.name) and p.id <> eb.id
  union all
  -- 3. Map links, by exact polygon (feature) ID
  select 3, 'map link', 'feature ' || eb.feature_id, null, bf.status,
    case when bf.feature_id is null then 'MISSING: will insert feature ' || eb.feature_id || ' -> ' || eb.id || ' as verified'
         when bf.place_id <> eb.id then 'CONFLICT: feature ' || eb.feature_id || ' is linked to ' || bf.place_id || ', expected ' || eb.id
         when bf.status = 'demo' then 'CONFLICT: feature ' || eb.feature_id || ' link is a demo row'
         when bf.status = 'verified' then 'ok: already verified, unchanged'
         else 'ok: will be marked verified' end
  from eb eb left join public.building_features bf on bf.feature_id = eb.feature_id
  union all
  -- 4. Other polygons linked to the same building (allowed by the schema; never changed here)
  select 4, 'map link (other polygon)', 'feature ' || bf.feature_id, null, bf.status,
    'REVIEW: ' || eb.id || ' is also linked to feature ' || bf.feature_id || ' (left unchanged)'
  from eb eb join public.building_features bf on bf.place_id = eb.id and bf.feature_id <> eb.feature_id
  union all
  -- 5. Floor plans, by exact ID
  select 5, 'floor plan', ef.id, ef.floor, fp.status,
    case when fp.id is null then 'MISSING: will insert as verified'
         when fp.building_id <> ef.building_id then 'CONFLICT: ' || ef.id || ' belongs to ' || fp.building_id || ', expected ' || ef.building_id
         when fp.floor <> ef.floor then 'CONFLICT: ' || ef.id || ' is floor ' || fp.floor || ', expected ' || ef.floor
         when fp.image_url <> ef.image_url then 'CONFLICT: ' || ef.id || ' image is ' || fp.image_url || ', expected ' || ef.image_url
         when (fp.width_px is not null and fp.width_px <> ef.w) or (fp.height_px is not null and fp.height_px <> ef.h)
              then 'CONFLICT: ' || ef.id || ' size is ' || coalesce(fp.width_px::text, '?') || 'x' || coalesce(fp.height_px::text, '?') || ', expected ' || ef.w || 'x' || ef.h
         when fp.status = 'demo' then 'CONFLICT: ' || ef.id || ' is a demo row'
         when fp.status = 'verified' then 'ok: already verified, unchanged'
              || case when fp.width_px is null or fp.height_px is null then ' (size empty, left as is)' else '' end
         else 'ok: will be marked verified' end
  from ef ef left join public.floor_plans fp on fp.id = ef.id
  union all
  -- 6. A different floor-plan row already on the same building and floor
  select 6, 'floor plan (other row, same floor)', fp.id, fp.floor, fp.status,
    'CONFLICT: ' || fp.building_id || ' floor ' || fp.floor || ' already has ' || fp.id || ' (' || fp.image_url || '); expected only ' || ef.id
  from ef ef join public.floor_plans fp on fp.building_id = ef.building_id and fp.floor = ef.floor and fp.id <> ef.id
  union all
  -- 7. A different floor-plan row already pointing at one of these images
  select 7, 'floor plan (image reused)', fp.id, fp.floor, fp.status,
    'CONFLICT: ' || fp.id || ' (' || fp.building_id || ' floor ' || fp.floor || ') uses ' || fp.image_url || ', which belongs to ' || ef.id
  from ef ef join public.floor_plans fp on fp.image_url = ef.image_url and fp.id <> ef.id
) r
order by (result like 'CONFLICT%') desc, ord, key, floor;


-- ============================ PART 2: transaction ============================
begin;

-- Who approved this publish. Stored in places.verified_by. The transaction refuses the placeholder.
create temp table _cfg on commit drop as select '<REVIEWER NAME>'::text as reviewer;

create temp table _eb (id text, name text, feature_id int, lng double precision, lat double precision, source text) on commit drop;
insert into _eb values
  ('bldg-quezon-hall', 'Quezon Hall', 10, 122.562676, 10.71313, 'blueprint quezon hall.png; map centroid'),
  ('bldg-hometel', 'Hometel', 11, 122.562861, 10.712854, 'blueprint hometel.png; map centroid'),
  ('bldg-college-of-dentistry', 'College of Dentistry', 14, 122.563568, 10.712278, 'blueprint college of dentistry.png; map centroid'),
  ('bldg-college-of-business-and-management', 'College of Business and Management', 15, 122.563924, 10.712069, 'blueprint college of business and management.png; map centroid'),
  ('bldg-cict-building', 'CICT Building', 19, 122.561602, 10.713152, 'blueprint college of information and communications technology.png; map centroid'),
  ('bldg-administration', 'Administration', 31, 122.561881, 10.714219, 'blueprint admin building.png; map centroid'),
  ('bldg-coop-building', 'Coop Building', 37, 122.561084, 10.712793, 'blueprint coop.png; map centroid'),
  ('bldg-college-of-medicine-roxas-hall', 'College of Medicine (Roxas Hall)', 38, 122.561815, 10.71286, 'blueprint roxas hall.png, roxas hall 2.png; map centroid');

create temp table _ef (id text, building_id text, floor int, label text, image_url text, w int, h int) on commit drop;
insert into _ef values
  ('fp-quezon-hall-1', 'bldg-quezon-hall', 1, '1st Floor', 'floor-plans/quezon-hall-floor-1.png', 1544, 580),
  ('fp-quezon-hall-2', 'bldg-quezon-hall', 2, '2nd Floor', 'floor-plans/quezon-hall-floor-2.png', 1544, 480),
  ('fp-hometel-1', 'bldg-hometel', 1, '1st floor', 'floor-plans/hometel-floor-1.png', 889, 460),
  ('fp-hometel-2', 'bldg-hometel', 2, '2nd floor', 'floor-plans/hometel-floor-2.png', 889, 420),
  ('fp-hometel-3', 'bldg-hometel', 3, '3rd floor', 'floor-plans/hometel-floor-3.png', 889, 420),
  ('fp-college-of-dentistry-1', 'bldg-college-of-dentistry', 1, '1st Floor', 'floor-plans/college-of-dentistry-floor-1.png', 997, 802),
  ('fp-college-of-dentistry-2', 'bldg-college-of-dentistry', 2, '2nd Floor', 'floor-plans/college-of-dentistry-floor-2.png', 997, 800),
  ('fp-college-of-business-and-management-1', 'bldg-college-of-business-and-management', 1, '1st Floor', 'floor-plans/college-of-business-and-management-floor-1.png', 1550, 630),
  ('fp-college-of-business-and-management-2', 'bldg-college-of-business-and-management', 2, '2nd Floor', 'floor-plans/college-of-business-and-management-floor-2.png', 1550, 640),
  ('fp-cict-building-1', 'bldg-cict-building', 1, 'FIRST FLOOR', 'floor-plans/cict-building-floor-1.png', 1135, 448),
  ('fp-cict-building-2', 'bldg-cict-building', 2, 'SECOND FLOOR', 'floor-plans/cict-building-floor-2.png', 1135, 445),
  ('fp-cict-building-3', 'bldg-cict-building', 3, 'THIRD FLOOR', 'floor-plans/cict-building-floor-3.png', 1135, 447),
  ('fp-administration-1', 'bldg-administration', 1, 'GROUND FLOOR', 'floor-plans/administration-floor-1.png', 1270, 640),
  ('fp-administration-2', 'bldg-administration', 2, 'SECOND FLOOR', 'floor-plans/administration-floor-2.png', 1270, 695),
  ('fp-coop-building-1', 'bldg-coop-building', 1, '1st Floor', 'floor-plans/coop-building-floor-1.png', 1065, 455),
  ('fp-coop-building-2', 'bldg-coop-building', 2, '2nd Floor', 'floor-plans/coop-building-floor-2.png', 1066, 382),
  ('fp-college-of-medicine-roxas-hall-1', 'bldg-college-of-medicine-roxas-hall', 1, 'ROXAS HALL 1st Floor', 'floor-plans/college-of-medicine-roxas-hall-floor-1.png', 1268, 1024),
  ('fp-college-of-medicine-roxas-hall-2', 'bldg-college-of-medicine-roxas-hall', 2, 'ROXAS HALL 2nd Floor', 'floor-plans/college-of-medicine-roxas-hall-floor-2.png', 1268, 1024);

create temp view _check as
select * from (
  -- 1. Buildings, by exact ID
  select 1 as ord, 'building' as object, eb.id as key, null::int as floor, p.status as current_status,
    case when p.id is null then 'MISSING: will insert as verified'
         when p.kind <> 'building' then 'CONFLICT: ' || eb.id || ' exists with kind ' || p.kind
         when p.status = 'demo' then 'CONFLICT: ' || eb.id || ' is a demo row'
         when lower(trim(p.name)) <> lower(eb.name) then 'REVIEW: name is "' || p.name || '", expected "' || eb.name || '" (name kept; '
              || case when p.status = 'verified' then 'already verified)' else 'will be marked verified)' end
         when p.status = 'verified' then 'ok: already verified, unchanged'
         else 'ok: will be marked verified' end as result
  from _eb eb left join public.places p on p.id = eb.id
  union all
  -- 2. Another building record with the same name under a different ID (would be a duplicate building)
  select 2, 'building (duplicate name)', p.id, null, p.status,
    'CONFLICT: building ' || p.id || ' is also named "' || p.name || '"; expected only ' || eb.id
  from _eb eb join public.places p on p.kind = 'building' and lower(trim(p.name)) = lower(eb.name) and p.id <> eb.id
  union all
  -- 3. Map links, by exact polygon (feature) ID
  select 3, 'map link', 'feature ' || eb.feature_id, null, bf.status,
    case when bf.feature_id is null then 'MISSING: will insert feature ' || eb.feature_id || ' -> ' || eb.id || ' as verified'
         when bf.place_id <> eb.id then 'CONFLICT: feature ' || eb.feature_id || ' is linked to ' || bf.place_id || ', expected ' || eb.id
         when bf.status = 'demo' then 'CONFLICT: feature ' || eb.feature_id || ' link is a demo row'
         when bf.status = 'verified' then 'ok: already verified, unchanged'
         else 'ok: will be marked verified' end
  from _eb eb left join public.building_features bf on bf.feature_id = eb.feature_id
  union all
  -- 4. Other polygons linked to the same building (allowed by the schema; never changed here)
  select 4, 'map link (other polygon)', 'feature ' || bf.feature_id, null, bf.status,
    'REVIEW: ' || eb.id || ' is also linked to feature ' || bf.feature_id || ' (left unchanged)'
  from _eb eb join public.building_features bf on bf.place_id = eb.id and bf.feature_id <> eb.feature_id
  union all
  -- 5. Floor plans, by exact ID
  select 5, 'floor plan', ef.id, ef.floor, fp.status,
    case when fp.id is null then 'MISSING: will insert as verified'
         when fp.building_id <> ef.building_id then 'CONFLICT: ' || ef.id || ' belongs to ' || fp.building_id || ', expected ' || ef.building_id
         when fp.floor <> ef.floor then 'CONFLICT: ' || ef.id || ' is floor ' || fp.floor || ', expected ' || ef.floor
         when fp.image_url <> ef.image_url then 'CONFLICT: ' || ef.id || ' image is ' || fp.image_url || ', expected ' || ef.image_url
         when (fp.width_px is not null and fp.width_px <> ef.w) or (fp.height_px is not null and fp.height_px <> ef.h)
              then 'CONFLICT: ' || ef.id || ' size is ' || coalesce(fp.width_px::text, '?') || 'x' || coalesce(fp.height_px::text, '?') || ', expected ' || ef.w || 'x' || ef.h
         when fp.status = 'demo' then 'CONFLICT: ' || ef.id || ' is a demo row'
         when fp.status = 'verified' then 'ok: already verified, unchanged'
              || case when fp.width_px is null or fp.height_px is null then ' (size empty, left as is)' else '' end
         else 'ok: will be marked verified' end
  from _ef ef left join public.floor_plans fp on fp.id = ef.id
  union all
  -- 6. A different floor-plan row already on the same building and floor
  select 6, 'floor plan (other row, same floor)', fp.id, fp.floor, fp.status,
    'CONFLICT: ' || fp.building_id || ' floor ' || fp.floor || ' already has ' || fp.id || ' (' || fp.image_url || '); expected only ' || ef.id
  from _ef ef join public.floor_plans fp on fp.building_id = ef.building_id and fp.floor = ef.floor and fp.id <> ef.id
  union all
  -- 7. A different floor-plan row already pointing at one of these images
  select 7, 'floor plan (image reused)', fp.id, fp.floor, fp.status,
    'CONFLICT: ' || fp.id || ' (' || fp.building_id || ' floor ' || fp.floor || ') uses ' || fp.image_url || ', which belongs to ' || ef.id
  from _ef ef join public.floor_plans fp on fp.image_url = ef.image_url and fp.id <> ef.id
) r;

do $$
declare conflicts text;
begin
  if (select reviewer from _cfg) in ('', '<REVIEWER NAME>') then
    raise exception 'Set the reviewer name in _cfg before running PART 2.';
  end if;
  if (select count(*) from _eb) <> 8 or (select count(*) from _ef) <> 18 then
    raise exception 'Expected 8 buildings and 18 floors in this patch.';
  end if;
  select string_agg(result, E'\n' order by ord, key) into conflicts from _check where result like 'CONFLICT%';
  if conflicts is not null then
    raise exception E'Stopped: existing data conflicts with this patch. Nothing was written.\n%', conflicts;
  end if;
end $$;

-- Buildings
insert into public.places (id, kind, name, lng, lat, status, source, verified_by, verified_at)
select id, 'building', name, lng, lat, 'verified', source, (select reviewer from _cfg), now() from _eb
on conflict (id) do nothing;
update public.places p set status = 'verified', verified_by = (select reviewer from _cfg), verified_at = now()
from _eb where p.id = _eb.id and p.kind = 'building' and p.status = 'unverified';

-- Map links
insert into public.building_features (feature_id, place_id, status)
select feature_id, id, 'verified' from _eb
on conflict (feature_id) do nothing;
update public.building_features bf set status = 'verified'
from _eb where bf.feature_id = _eb.feature_id and bf.place_id = _eb.id and bf.status = 'unverified';

-- Floor plans
insert into public.floor_plans (id, building_id, floor, label, image_url, width_px, height_px, status)
select id, building_id, floor, label, image_url, w, h, 'verified' from _ef
on conflict (id) do nothing;
update public.floor_plans fp set status = 'verified', width_px = coalesce(fp.width_px, _ef.w), height_px = coalesce(fp.height_px, _ef.h)
from _ef where fp.id = _ef.id and fp.building_id = _ef.building_id and fp.floor = _ef.floor
  and fp.image_url = _ef.image_url and fp.status = 'unverified';

-- Final guard: every one of the 18 pairs must now be fully visible, or nothing is kept.
do $$
declare missing text;
begin
  select string_agg(ef.id, ', ' order by ef.id) into missing
  from _ef ef join _eb eb on eb.id = ef.building_id
  left join public.places p on p.id = eb.id
  left join public.building_features bf on bf.feature_id = eb.feature_id
  left join public.floor_plans fp on fp.id = ef.id
  where not (coalesce(p.kind = 'building' and p.status = 'verified', false)
         and coalesce(bf.place_id = eb.id and bf.status = 'verified', false)
         and coalesce(fp.building_id = ef.building_id and fp.floor = ef.floor and fp.image_url = ef.image_url and fp.status = 'verified', false));
  if missing is not null then
    raise exception 'Stopped: not fully published after the writes: %. Nothing was written.', missing;
  end if;
end $$;

commit;


-- ============================ PART 3: post-check (read-only) ============================
with eb(id, name, feature_id, lng, lat, source) as (values
  ('bldg-quezon-hall', 'Quezon Hall', 10, 122.562676, 10.71313, 'blueprint quezon hall.png; map centroid'),
  ('bldg-hometel', 'Hometel', 11, 122.562861, 10.712854, 'blueprint hometel.png; map centroid'),
  ('bldg-college-of-dentistry', 'College of Dentistry', 14, 122.563568, 10.712278, 'blueprint college of dentistry.png; map centroid'),
  ('bldg-college-of-business-and-management', 'College of Business and Management', 15, 122.563924, 10.712069, 'blueprint college of business and management.png; map centroid'),
  ('bldg-cict-building', 'CICT Building', 19, 122.561602, 10.713152, 'blueprint college of information and communications technology.png; map centroid'),
  ('bldg-administration', 'Administration', 31, 122.561881, 10.714219, 'blueprint admin building.png; map centroid'),
  ('bldg-coop-building', 'Coop Building', 37, 122.561084, 10.712793, 'blueprint coop.png; map centroid'),
  ('bldg-college-of-medicine-roxas-hall', 'College of Medicine (Roxas Hall)', 38, 122.561815, 10.71286, 'blueprint roxas hall.png, roxas hall 2.png; map centroid')
), ef(id, building_id, floor, label, image_url, w, h) as (values
  ('fp-quezon-hall-1', 'bldg-quezon-hall', 1, '1st Floor', 'floor-plans/quezon-hall-floor-1.png', 1544, 580),
  ('fp-quezon-hall-2', 'bldg-quezon-hall', 2, '2nd Floor', 'floor-plans/quezon-hall-floor-2.png', 1544, 480),
  ('fp-hometel-1', 'bldg-hometel', 1, '1st floor', 'floor-plans/hometel-floor-1.png', 889, 460),
  ('fp-hometel-2', 'bldg-hometel', 2, '2nd floor', 'floor-plans/hometel-floor-2.png', 889, 420),
  ('fp-hometel-3', 'bldg-hometel', 3, '3rd floor', 'floor-plans/hometel-floor-3.png', 889, 420),
  ('fp-college-of-dentistry-1', 'bldg-college-of-dentistry', 1, '1st Floor', 'floor-plans/college-of-dentistry-floor-1.png', 997, 802),
  ('fp-college-of-dentistry-2', 'bldg-college-of-dentistry', 2, '2nd Floor', 'floor-plans/college-of-dentistry-floor-2.png', 997, 800),
  ('fp-college-of-business-and-management-1', 'bldg-college-of-business-and-management', 1, '1st Floor', 'floor-plans/college-of-business-and-management-floor-1.png', 1550, 630),
  ('fp-college-of-business-and-management-2', 'bldg-college-of-business-and-management', 2, '2nd Floor', 'floor-plans/college-of-business-and-management-floor-2.png', 1550, 640),
  ('fp-cict-building-1', 'bldg-cict-building', 1, 'FIRST FLOOR', 'floor-plans/cict-building-floor-1.png', 1135, 448),
  ('fp-cict-building-2', 'bldg-cict-building', 2, 'SECOND FLOOR', 'floor-plans/cict-building-floor-2.png', 1135, 445),
  ('fp-cict-building-3', 'bldg-cict-building', 3, 'THIRD FLOOR', 'floor-plans/cict-building-floor-3.png', 1135, 447),
  ('fp-administration-1', 'bldg-administration', 1, 'GROUND FLOOR', 'floor-plans/administration-floor-1.png', 1270, 640),
  ('fp-administration-2', 'bldg-administration', 2, 'SECOND FLOOR', 'floor-plans/administration-floor-2.png', 1270, 695),
  ('fp-coop-building-1', 'bldg-coop-building', 1, '1st Floor', 'floor-plans/coop-building-floor-1.png', 1065, 455),
  ('fp-coop-building-2', 'bldg-coop-building', 2, '2nd Floor', 'floor-plans/coop-building-floor-2.png', 1066, 382),
  ('fp-college-of-medicine-roxas-hall-1', 'bldg-college-of-medicine-roxas-hall', 1, 'ROXAS HALL 1st Floor', 'floor-plans/college-of-medicine-roxas-hall-floor-1.png', 1268, 1024),
  ('fp-college-of-medicine-roxas-hall-2', 'bldg-college-of-medicine-roxas-hall', 2, 'ROXAS HALL 2nd Floor', 'floor-plans/college-of-medicine-roxas-hall-floor-2.png', 1268, 1024)
)
select eb.name as building, ef.floor, ef.image_url as expected_image,
  coalesce(p.kind = 'building' and p.status = 'verified', false) as building_verified,
  coalesce(bf.place_id = eb.id and bf.status = 'verified', false) as map_link_verified,
  coalesce(fp.building_id = ef.building_id and fp.floor = ef.floor and fp.image_url = ef.image_url and fp.status = 'verified', false) as floor_row_verified,
  coalesce(p.kind = 'building' and p.status = 'verified', false)
    and coalesce(bf.place_id = eb.id and bf.status = 'verified', false)
    and coalesce(fp.building_id = ef.building_id and fp.floor = ef.floor and fp.image_url = ef.image_url and fp.status = 'verified', false) as ready,
  fp.image_url as current_image
from ef
join eb on eb.id = ef.building_id
left join public.places p on p.id = eb.id
left join public.building_features bf on bf.feature_id = eb.feature_id
left join public.floor_plans fp on fp.id = ef.id
order by eb.name, ef.floor;
