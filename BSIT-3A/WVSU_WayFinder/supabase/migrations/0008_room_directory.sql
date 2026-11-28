-- Campus room directory: room types, alternate names, review notes, and one read-only view the app
-- fetches the whole directory from. Data lives in supabase/seed/room_directory.sql.
begin;

-- What a room is for, so the directory can filter: a classroom/room, a lab, an office, or a facility (CR, lobby, canteen stall).
alter table public.places add column if not exists room_type text
  check (room_type is null or room_type in ('room','lab','office','facility'));
-- Other names people use for a building ("PESCAR" for the COP Building).
alter table public.places add column if not exists aka text[];
-- What the blueprint transcription asked the team to double-check (typo kept as printed, shared box, and so on).
alter table public.places add column if not exists review_note text;

-- Some blueprints don't print a floor (CFL, College of Communication, SDG rooms).
alter table public.floor_plans alter column floor drop not null;

create index if not exists places_kind_parent_idx on public.places (kind, parent_id);
create index if not exists places_room_code_idx on public.places (room_code) where room_code is not null;
create index if not exists floor_plan_rooms_plan_idx on public.floor_plan_rooms (floor_plan_id);

grant select on public.places to anon, authenticated;

-- One row per room or office, with its building and (when transcribed) its position on a floor plan.
-- security_invoker: the caller's RLS applies, so only verified rows come back.
drop view if exists public.room_directory;
create view public.room_directory with (security_invoker = true) as
select
  r.id,
  r.kind,
  r.room_type,
  r.name,
  r.room_label,
  r.room_code,
  r.floor,
  b.id          as building_id,
  b.name        as building_name,
  b.short_name  as building_short_name,
  b.aka         as building_aka,
  b.lng,
  b.lat,
  fp.id         as floor_plan_id,
  fp.image_url  as floor_plan_url,
  s.x, s.y, s.w, s.h,
  r.review_note
from public.places r
join public.places b on b.id = r.parent_id and b.kind = 'building'
left join public.floor_plan_rooms s on s.place_id = r.id
left join public.floor_plans fp on fp.id = s.floor_plan_id
where r.kind in ('room','office');

grant select on public.room_directory to anon, authenticated;

-- Public bucket for the floor-plan images floor_plans.image_url points at (upload supabase/seed/floor-plans/).
insert into storage.buckets (id, name, public) values ('floor-plans', 'floor-plans', true)
on conflict (id) do update set public = true;

commit;
