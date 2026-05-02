-- Development policies for the Cleaning Dispatch demo.
-- Run this in the Supabase SQL editor for the project used by VITE_SUPABASE_URL.
-- These policies allow the public anon key to read and update dispatch rows.
-- Replace them with authenticated, tenant/user-scoped policies before production.

update public.workers
set status = 'free'
where status is null or status = '';

alter table public.jobs enable row level security;
alter table public.workers enable row level security;

grant select, update on public.jobs to anon, authenticated;
grant select, update on public.workers to anon, authenticated;

drop policy if exists "Dispatch demo can read jobs" on public.jobs;
drop policy if exists "Dispatch demo can update jobs" on public.jobs;
drop policy if exists "Dispatch demo can read workers" on public.workers;
drop policy if exists "Dispatch demo can update workers" on public.workers;

create policy "Dispatch demo can read jobs"
on public.jobs
for select
to anon, authenticated
using (true);

create policy "Dispatch demo can update jobs"
on public.jobs
for update
to anon, authenticated
using (true)
with check (true);

create policy "Dispatch demo can read workers"
on public.workers
for select
to anon, authenticated
using (true);

create policy "Dispatch demo can update workers"
on public.workers
for update
to anon, authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workers'
  ) then
    alter publication supabase_realtime add table public.workers;
  end if;
end $$;
