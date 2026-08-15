-- Link each personalized assignment back to the teacher's original session
-- so the dashboard can group child sessions under their parent.
alter table public.assignments
  add column if not exists parent_session_id uuid references public.pathway_sessions (id) on delete set null;

create index if not exists assignments_parent_session_id_idx on public.assignments (parent_session_id);
