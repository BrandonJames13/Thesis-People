-- Fixes import-related Row Level Security failures for admin users.
-- Run this in Supabase SQL Editor.

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users_table u
    where u.user_id = auth.uid()
      and u.role = 'admin'
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

alter table if exists public.subjects enable row level security;
alter table if exists public.subject_sections enable row level security;
alter table if exists public.instructor_subject_sections enable row level security;
alter table if exists public.rooms enable row level security;
alter table if exists public.instructors enable row level security;
alter table if exists public.schedule_assignments enable row level security;

-- Subjects policies
drop policy if exists subjects_admin_select on public.subjects;
drop policy if exists subjects_admin_insert on public.subjects;
drop policy if exists subjects_admin_update on public.subjects;
drop policy if exists subjects_admin_delete on public.subjects;

create policy subjects_admin_select on public.subjects
for select to authenticated
using (public.is_admin_user());

create policy subjects_admin_insert on public.subjects
for insert to authenticated
with check (public.is_admin_user());

create policy subjects_admin_update on public.subjects
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy subjects_admin_delete on public.subjects
for delete to authenticated
using (public.is_admin_user());

-- Subject sections policies
drop policy if exists subject_sections_admin_select on public.subject_sections;
drop policy if exists subject_sections_admin_insert on public.subject_sections;
drop policy if exists subject_sections_admin_update on public.subject_sections;
drop policy if exists subject_sections_admin_delete on public.subject_sections;

create policy subject_sections_admin_select on public.subject_sections
for select to authenticated
using (public.is_admin_user());

create policy subject_sections_admin_insert on public.subject_sections
for insert to authenticated
with check (public.is_admin_user());

create policy subject_sections_admin_update on public.subject_sections
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy subject_sections_admin_delete on public.subject_sections
for delete to authenticated
using (public.is_admin_user());

-- Rooms policies
drop policy if exists rooms_admin_select on public.rooms;
drop policy if exists rooms_admin_insert on public.rooms;
drop policy if exists rooms_admin_update on public.rooms;
drop policy if exists rooms_admin_delete on public.rooms;

create policy rooms_admin_select on public.rooms
for select to authenticated
using (public.is_admin_user());

create policy rooms_admin_insert on public.rooms
for insert to authenticated
with check (public.is_admin_user());

create policy rooms_admin_update on public.rooms
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy rooms_admin_delete on public.rooms
for delete to authenticated
using (public.is_admin_user());

-- Instructors policies
drop policy if exists instructors_admin_select on public.instructors;
drop policy if exists instructors_admin_insert on public.instructors;
drop policy if exists instructors_admin_update on public.instructors;
drop policy if exists instructors_admin_delete on public.instructors;

create policy instructors_admin_select on public.instructors
for select to authenticated
using (public.is_admin_user());

create policy instructors_admin_insert on public.instructors
for insert to authenticated
with check (public.is_admin_user());

create policy instructors_admin_update on public.instructors
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy instructors_admin_delete on public.instructors
for delete to authenticated
using (public.is_admin_user());

-- Instructor subject sections policies
drop policy if exists instructor_subject_sections_admin_select on public.instructor_subject_sections;
drop policy if exists instructor_subject_sections_admin_insert on public.instructor_subject_sections;
drop policy if exists instructor_subject_sections_admin_update on public.instructor_subject_sections;
drop policy if exists instructor_subject_sections_admin_delete on public.instructor_subject_sections;

create policy instructor_subject_sections_admin_select on public.instructor_subject_sections
for select to authenticated
using (public.is_admin_user());

create policy instructor_subject_sections_admin_insert on public.instructor_subject_sections
for insert to authenticated
with check (public.is_admin_user());

create policy instructor_subject_sections_admin_update on public.instructor_subject_sections
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy instructor_subject_sections_admin_delete on public.instructor_subject_sections
for delete to authenticated
using (public.is_admin_user());

-- Schedule assignments policies
drop policy if exists schedule_assignments_admin_select on public.schedule_assignments;
drop policy if exists schedule_assignments_admin_insert on public.schedule_assignments;
drop policy if exists schedule_assignments_admin_update on public.schedule_assignments;
drop policy if exists schedule_assignments_admin_delete on public.schedule_assignments;

create policy schedule_assignments_admin_select on public.schedule_assignments
for select to authenticated
using (public.is_admin_user());

create policy schedule_assignments_admin_insert on public.schedule_assignments
for insert to authenticated
with check (public.is_admin_user());

create policy schedule_assignments_admin_update on public.schedule_assignments
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy schedule_assignments_admin_delete on public.schedule_assignments
for delete to authenticated
using (public.is_admin_user());
