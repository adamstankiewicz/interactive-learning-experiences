-- ---------------------------------------------------------------------------
-- Re-apply two migrations that share a version, one of which never ran.
--
-- `20260815140000_assignment_parent_session.sql` (#52) and
-- `20260815140000_roster_revoke_anon_read.sql` (#48) were written on parallel
-- branches and landed with the same `20260815140000` prefix.
--
-- Supabase records an applied migration by that timestamp as its unique id and
-- compares only timestamps, so once the version is recorded the second file is
-- treated as already applied and skipped -- with no error and no output. Which
-- of the two ran depends on when a given database last migrated, so different
-- databases are in different states and nothing reports which.
--
-- Renaming the originals would fix it, but rewrites history that is already
-- deployed. This runs forward instead: every statement is idempotent, so it is
-- a no-op where both already applied and a repair everywhere else.
--
-- The revoke is the half worth caring about. `roster_students.adaptations` is
-- the free-text column the UI solicits IEP and accommodation notes into, and
-- `20260815120000_roster.sql` granted `select` on it to anon/authenticated.
-- That grant is inert only because RLS is on with no policies -- a fail-closed
-- accident, not a design. It stops being inert the first time anyone adds a
-- permissive policy.
-- ---------------------------------------------------------------------------

-- From 20260815140000_assignment_parent_session.sql
alter table public.assignments
  add column if not exists parent_session_id uuid references public.pathway_sessions (id) on delete set null;

create index if not exists assignments_parent_session_id_idx on public.assignments (parent_session_id);

-- From 20260815140000_roster_revoke_anon_read.sql
revoke select on public.roster_students from anon, authenticated;
revoke select on public.assignments      from anon, authenticated;
