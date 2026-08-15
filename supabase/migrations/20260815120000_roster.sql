-- Roster tables: teacher-managed student profiles and pathway assignments.

-- ---------------------------------------------------------------------------
-- roster_students — rich learning profiles created by the teacher, separate
-- from the anonymous `students` table used for mastery tracking.
-- ---------------------------------------------------------------------------
create table if not exists public.roster_students (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  grade                  text not null,
  learning_style         jsonb not null default '{}'::jsonb,
  preferred_activity_types text[] not null default '{}',
  avoid_activity_types   text[] not null default '{}',
  adaptations            text not null default '',
  pacing_preference      text not null default '',
  attention_span_minutes integer not null default 20,
  social_preference      text not null default 'pairs',
  motivators             text[] not null default '{}',
  feedback_style         text not null default '',
  reading_level_grade    text not null default '',
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- assignments — a teacher-generated pathway session assigned to a roster
-- student. Each row is one personalized session for one student.
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id                 uuid primary key default gen_random_uuid(),
  roster_student_id  uuid not null references public.roster_students (id) on delete cascade,
  session_id         uuid not null references public.pathway_sessions (id) on delete cascade,
  topic              text not null,
  created_at         timestamptz not null default now()
);

create index if not exists assignments_roster_student_idx
  on public.assignments (roster_student_id, created_at desc);

create index if not exists assignments_session_idx
  on public.assignments (session_id);

-- ---------------------------------------------------------------------------
-- RLS — deny by default, service role writes, anon can read
-- ---------------------------------------------------------------------------
alter table public.roster_students enable row level security;
alter table public.assignments      enable row level security;

-- No per-user isolation yet (no teacher auth). Service role bypasses RLS.
-- anon/authenticated get read access so the student homepage can load.
grant select, insert, update, delete
  on public.roster_students, public.assignments
  to service_role;

grant select
  on public.roster_students, public.assignments
  to anon, authenticated;
