-- PILOT: Quezon Hall -> floor 1 -> QH 1. One building, one floor plan, one room, one highlight.
-- NOT APPLIED. Run in the Supabase SQL editor, one part at a time, in this order:
--   0. Apply supabase/migrations/0006_building_features.sql, then 0007_rooms_on_blueprints.sql (review first).
--   1. Storage: create a PUBLIC bucket named  floor-plans  and upload
--        BSIT-3A/WVSU_WayFinder/data-intake/floor-plan-images/quezon-hall-floor-1.png
--      as object  quezon-hall-floor-1.png   (1544 x 580 px, sha256 54fc8e9f1a114f0db4434047e163f27f3538752b88bef6fcfd01582b835eaffa).
--      image_url below stores the Storage path 'floor-plans/quezon-hall-floor-1.png'; both apps resolve it
--      against their configured Supabase URL, so no project URL is written here.
--   2. PART A (read-only).  3. PART B (writes, all 'unverified' = invisible to students).
--   4. Only after your approval: PART C (publish).
-- Every statement is safe to re-run; nothing is duplicated.

-- ======================= PART A: read-only checks =======================
-- Migrations present?
select to_regclass('public.building_features') as building_features_0006,
       to_regclass('public.floor_plan_rooms')  as floor_plan_rooms_0007,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'places' and column_name = 'room_label') as room_label_0007;
-- Is there already a Quezon Hall building, a floor-1 plan, a QH1 room, or a link for map polygon 10?
select id, kind, name, status from public.places where kind = 'building' and (name ilike '%quezon%' or id ilike '%quezon%' or id ilike '%qh%');
select id, kind, name, room_code, floor, parent_id, status from public.places where room_code = 'QH1';
select * from public.building_features where feature_id = 10;
select id, building_id, floor, image_url, status from public.floor_plans where id = 'fp-quezon-hall-1' or image_url like '%quezon-hall-floor-1%';
-- Rows Part B/C would touch that are ALREADY verified (they are reused as-is and never modified):
select 'places' t, id, status from public.places where status = 'verified' and (room_code = 'QH1' or (kind = 'building' and lower(trim(name)) = 'quezon hall'))
union all select 'building_features', feature_id::text, status from public.building_features where feature_id = 10 and status = 'verified'
union all select 'floor_plan_rooms', id, status from public.floor_plan_rooms where id = 'spot-room-quezon-hall-f1-qh1' and status = 'verified';

-- ======================= PART B: pilot rows, unverified =======================
do $$
declare
  b  text;  -- building ID: an existing Quezon Hall record if there is one, else bldg-quezon-hall
  fp text;
  rm text;
begin
  select id into b from public.places
   where kind = 'building' and (lower(trim(name)) = 'quezon hall' or id = 'bldg-quezon-hall')
   order by (status = 'verified') desc, id limit 1;
  if b is null then
    b := 'bldg-quezon-hall';
    -- Map point = centroid of MapTiler polygon place_id 10 (Quezon Hall), so the pin and destination card
    -- know where the building is. An existing record keeps its own coordinates.
    insert into public.places (id, kind, name, lng, lat, status, source)
    values (b, 'building', 'Quezon Hall', 122.562676, 10.71313, 'unverified', 'MapTiler polygon place_id 10; blueprint quezon hall.png');
  end if;
  raise notice 'Quezon Hall building ID: %', b;

  -- Link map polygon 10 (Quezon Hall) unless it is already linked; never re-point an existing link.
  insert into public.building_features (feature_id, place_id, status) values (10, b, 'unverified')
  on conflict (feature_id) do nothing;
  if (select place_id from public.building_features where feature_id = 10) <> b then
    raise warning 'Map polygon 10 is already linked to a different place: %', (select place_id from public.building_features where feature_id = 10);
  end if;

  -- Floor 1 plan: reuse an existing one for this building, else create it.
  select id into fp from public.floor_plans where building_id = b and floor = 1 order by id limit 1;
  -- The highlight's fractions belong to THIS image; never attach them to a different picture.
  if fp is not null and (select image_url from public.floor_plans where id = fp) <> 'floor-plans/quezon-hall-floor-1.png' then
    raise exception 'Quezon Hall floor 1 already has floor plan % with a different image (%). Stop and review.', fp, (select image_url from public.floor_plans where id = fp);
  end if;
  if fp is null then
    fp := 'fp-quezon-hall-1';
    insert into public.floor_plans (id, building_id, floor, label, image_url, width_px, height_px, status)
    values (fp, b, 1, '1st Floor', 'floor-plans/quezon-hall-floor-1.png', 1544, 580, 'unverified');
  end if;
  raise notice 'Floor plan ID: %', fp;

  -- QH 1: reuse an existing QH1 room (room_code is unique), else create it.
  select id into rm from public.places where room_code = 'QH1';
  if rm is not null and (select parent_id from public.places where id = rm) is distinct from b then
    raise exception 'Room code QH1 already belongs to % under %, not %. Stop and review.', rm, (select parent_id from public.places where id = rm), b;
  end if;
  if rm is null then
    rm := 'room-quezon-hall-f1-qh1';
    insert into public.places (id, kind, name, room_code, room_label, floor, parent_id, status, source)
    values (rm, 'room', 'QH 1', 'QH1', 'QH 1', 1, b, 'unverified', 'blueprint quezon hall.png (1st Floor)');
  end if;
  raise notice 'QH 1 room ID: %', rm;

  -- Highlight: fractions of the 1544 x 580 image (x 333-486 px, y 12-309 px).
  insert into public.floor_plan_rooms (id, floor_plan_id, place_id, label, shape, x, y, w, h, status)
  values ('spot-room-quezon-hall-f1-qh1', fp, rm, 'QH 1', 'rect', 0.2157, 0.0207, 0.0997, 0.5138, 'unverified')
  on conflict (id) do update set floor_plan_id = excluded.floor_plan_id, place_id = excluded.place_id,
    x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h
  where public.floor_plan_rooms.status <> 'verified';  -- a published highlight is never changed here
end $$;

-- Check what Part B wrote (still invisible to students):
select p.id, p.room_label, p.floor, b.id as building, b.name, f.id as floor_plan, f.image_url, s.x, s.y, s.w, s.h, p.status
  from public.places p join public.places b on b.id = p.parent_id
  join public.floor_plan_rooms s on s.place_id = p.id join public.floor_plans f on f.id = s.floor_plan_id
 where p.room_code = 'QH1';

-- ======================= PART C: publish (ONLY after approval) =======================
-- Makes exactly these five rows visible to students through the existing 'verified'-only policies.
-- Replace <reviewer> with your name. Policies are not changed. Rows that are already verified keep
-- their status, verified_by and verified_at.
-- begin;
-- update public.places set status = 'verified', verified_by = '<reviewer>', verified_at = now()
--  where (id = (select parent_id from public.places where room_code = 'QH1') or room_code = 'QH1') and status <> 'verified';
-- update public.building_features set status = 'verified' where feature_id = 10 and status <> 'verified';
-- update public.floor_plans set status = 'verified'
--  where id = (select floor_plan_id from public.floor_plan_rooms where id = 'spot-room-quezon-hall-f1-qh1') and status <> 'verified';
-- update public.floor_plan_rooms set status = 'verified' where id = 'spot-room-quezon-hall-f1-qh1' and status <> 'verified';
-- commit;
