-- Replace raw open_count increment with a deduped (session, student) table.
-- open_count on pathway_sessions is left in place (nullable-able via default)
-- so old rows don't break; it is simply no longer written to.

create table if not exists public.session_opens (
  session_id uuid not null references public.pathway_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  opened_at  timestamptz not null default now(),
  primary key (session_id, student_id)
);

alter table public.session_opens enable row level security;

grant select, insert on public.session_opens to service_role;
