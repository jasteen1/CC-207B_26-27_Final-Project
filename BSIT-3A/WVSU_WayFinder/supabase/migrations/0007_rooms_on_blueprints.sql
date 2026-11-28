-- Classroom codes, printed door labels, room-code prefixes and room positions on blueprints.
-- NOT APPLIED: review before running against the live project.
begin;

-- The label exactly as printed on the door ("ICT 201"); room_code stays the normalized search key (ICT201).
alter table public.places add column if not exists room_label text;

-- Blueprint image size in pixels, recorded when the room positions are encoded.
alter table public.floor_plans add column if not exists width_px  int check (width_px  is null or width_px  > 0);
alter table public.floor_plans add column if not exists height_px int check (height_px is null or height_px > 0);

-- Where a room or office sits on one specific blueprint. Coordinates are fractions (0-1) of that
-- image's width/height, so a highlight stays aligned at any zoom, window size or orientation.
create table if not exists public.floor_plan_rooms (
  id            text primary key,
  floor_plan_id text not null references public.floor_plans(id) on delete cascade,
  place_id      text not null references public.places(id) on delete cascade,
  label         text not null,                                   -- as printed on the blueprint
  shape         text not null check (shape in ('rect','polygon','marker')),
  x             double precision not null check (x between 0 and 1),
  y             double precision not null check (y between 0 and 1),
  w             double precision check (w is null or (w > 0 and w <= 1)),
  h             double precision check (h is null or (h > 0 and h <= 1)),
  points        jsonb,                                           -- polygon: [[x,y], ...] fractions
  status        text not null default 'unverified' check (status in ('demo','unverified','verified')),
  check (shape <> 'rect' or (w is not null and h is not null)),
  check (shape <> 'polygon' or jsonb_typeof(points) = 'array')
);
create index if not exists floor_plan_rooms_place_idx on public.floor_plan_rooms(place_id);

-- Room-code prefix -> building (e.g. ICT -> CICT Building). A prefix never confirms a room or a floor.
create table if not exists public.room_code_prefixes (
  prefix      text primary key check (prefix ~ '^[A-Z]{1,5}$'),
  building_id text references public.places(id) on delete set null,
  map_name    text,                                              -- exact MapTiler dataset name
  note        text,
  status      text not null default 'unverified' check (status in ('demo','unverified','verified'))
);

do $$ declare t text; begin
  foreach t in array array['floor_plan_rooms','room_code_prefixes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read verified" on public.%I', t);
    execute format('create policy "read verified" on public.%I for select to anon, authenticated using (status = ''verified'')', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;
commit;
