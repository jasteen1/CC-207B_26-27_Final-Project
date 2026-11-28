-- Tappable buildings on the Campus Map.
-- Links each building polygon in the team's MapTiler "Wayfinder" dataset (its integer `place_id`
-- property) to a shared place ID in public.places. One place can have several polygons (for example
-- "College of Communication" is drawn as two). Unlinked polygons still open a card with the dataset name.
begin;

alter table public.places add column if not exists description text;
-- Public URL of the building photo. Null = the app shows "Building photo coming soon".
alter table public.places add column if not exists photo_url text;

create table if not exists public.building_features (
  feature_id int primary key check (feature_id > 0),      -- MapTiler dataset property `place_id`
  place_id   text not null references public.places(id) on delete cascade,
  status     text not null default 'unverified' check (status in ('demo','unverified','verified'))
);
create index if not exists building_features_place_idx on public.building_features(place_id);

alter table public.building_features enable row level security;
drop policy if exists "read verified" on public.building_features;
create policy "read verified" on public.building_features
  for select to anon, authenticated using (status = 'verified');
grant select on public.building_features to anon, authenticated;

-- floor_plans.image_url may point at an exported Canva blueprint (PNG/JPG/SVG). Only rows marked
-- 'verified' (approved) are readable by the app, so an unapproved blueprint never shows.
comment on column public.floor_plans.image_url is 'Public image URL, e.g. an approved Canva blueprint export';

commit;
