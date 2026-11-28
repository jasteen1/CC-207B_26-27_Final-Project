-- WVSU WayFinder: secure administrator access to public.places

begin;

-- The admin UI needs an explicit archive state. Archived rows remain in the
-- database and are excluded from student queries, which only read verified rows.
alter table public.places
  drop constraint if exists places_status_check;

alter table public.places
  add constraint places_status_check
  check (status = any (array['demo', 'unverified', 'verified', 'archived']::text[]));

-- A real updated timestamp for the Admin Directory table.
alter table public.places
  add column if not exists updated_at timestamp with time zone not null default now();

create or replace function public.set_wayfinder_place_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_wayfinder_places_updated_at on public.places;
create trigger trg_wayfinder_places_updated_at
before update on public.places
for each row
execute function public.set_wayfinder_place_updated_at();

-- Only Auth users explicitly listed here can manage the campus directory.
create table if not exists public.wayfinder_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table public.wayfinder_admins enable row level security;
grant select on public.wayfinder_admins to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wayfinder_admins'
      and policyname = 'wayfinder admins can read own membership'
  ) then
    execute 'create policy "wayfinder admins can read own membership" on public.wayfinder_admins for select to authenticated using (user_id = auth.uid())';
  end if;
end;
$$;

-- SECURITY DEFINER avoids RLS recursion when places policies check membership.
create or replace function public.is_wayfinder_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wayfinder_admins as a
    where a.user_id = auth.uid()
      and a.is_active = true
  );
$$;

revoke all on function public.is_wayfinder_admin() from public;
revoke all on function public.is_wayfinder_admin() from anon;
grant execute on function public.is_wayfinder_admin() to authenticated;

-- Keep student access restricted to verified rows. Admin policies below are
-- additional authenticated-only policies; they do not grant anon write access.
alter table public.places enable row level security;
grant select on public.places to anon, authenticated;
grant insert, update on public.places to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'places'
      and policyname = 'wayfinder public can read verified places'
  ) then
    execute 'create policy "wayfinder public can read verified places" on public.places for select to anon, authenticated using (status = ''verified'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'places'
      and policyname = 'wayfinder admins can read all places'
  ) then
    execute 'create policy "wayfinder admins can read all places" on public.places for select to authenticated using (public.is_wayfinder_admin())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'places'
      and policyname = 'wayfinder admins can insert places'
  ) then
    execute 'create policy "wayfinder admins can insert places" on public.places for insert to authenticated with check (public.is_wayfinder_admin())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'places'
      and policyname = 'wayfinder admins can update places'
  ) then
    execute 'create policy "wayfinder admins can update places" on public.places for update to authenticated using (public.is_wayfinder_admin()) with check (public.is_wayfinder_admin())';
  end if;

end;
$$;

commit;

-- SECURITY REVIEW: run this after the migration and inspect every places policy.
-- RLS policies are permissive by default (OR-combined). Remove any old anon/public
-- policy that allows unverified rows, or the student directory could expose drafts.
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('places', 'wayfinder_admins')
order by tablename, policyname;