-- WVSU WayFinder: faculty directory access for students and administrators.
-- Requires 0007_wayfinder_admin_access.sql (public.is_wayfinder_admin()).
-- Uses the supplied public.faculty_directory schema; no new faculty columns or tables are added.

begin;

alter table public.faculty_directory enable row level security;

grant select on public.faculty_directory to anon, authenticated;
grant insert, update on public.faculty_directory to authenticated;

-- Recreate only this migration's policies so the file can safely be rerun.
drop policy if exists "wayfinder public can read verified faculty" on public.faculty_directory;
drop policy if exists "wayfinder admins can read all faculty" on public.faculty_directory;
drop policy if exists "wayfinder admins can insert faculty" on public.faculty_directory;
drop policy if exists "wayfinder admins can update faculty" on public.faculty_directory;

-- Student app: verified faculty profiles only.
create policy "wayfinder public can read verified faculty"
on public.faculty_directory
for select
to anon, authenticated
using (status = 'verified');

-- Admin dashboard: administrators can review all faculty records.
create policy "wayfinder admins can read all faculty"
on public.faculty_directory
for select
to authenticated
using (public.is_wayfinder_admin());

create policy "wayfinder admins can insert faculty"
on public.faculty_directory
for insert
to authenticated
with check (public.is_wayfinder_admin());

create policy "wayfinder admins can update faculty"
on public.faculty_directory
for update
to authenticated
using (public.is_wayfinder_admin())
with check (public.is_wayfinder_admin());

commit;

-- SECURITY REVIEW:
-- Check all faculty policies. Remove any older permissive public/anon policy that
-- allows reading rows other than status='verified'. Policies are OR-combined.
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'faculty_directory'
order by policyname;
