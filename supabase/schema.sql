-- Adaptive layer for the pathway pipeline.
--
-- The pathway generator is stateless: topic in, pathway out. These tables add
-- the missing half — what the student actually did, distilled into a profile
-- that feeds the next generation.
--
-- Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- students — anonymous by default; auth_user_id links a real account later
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  display_name text not null default 'Learner',
  grade_hint   text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pathway_sessions — one row per generated pathway, storing the graph-verified
-- facts alongside what the model authored from them
-- ---------------------------------------------------------------------------
create table if not exists public.pathway_sessions (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students (id) on delete cascade,
  topic          text not null,
  grade_hint     text,
  anchor         jsonb not null default '{}'::jsonb,
  -- Codes the model proposed that the graph rejected. Kept because the
  -- rejection rate is a signal about the model, not just debug noise.
  rejected_codes text[] not null default '{}',
  plan           jsonb not null default '{}'::jsonb,
  -- Deprecated by step_widgets below: a pathway now builds one widget per
  -- step, not one for the whole run. Left in place, nullable, rather than
  -- dropped — existing rows keep their data, and dropping a column in a
  -- shared database is not a call this migration makes for you.
  widget         jsonb,
  -- stepIndex -> the widget generated for that step, e.g. {"0": {...}, "2": {...}}.
  step_widgets   jsonb not null default '{}'::jsonb,
  standard_code  text generated always as (anchor -> 'standard' ->> 'statementCode') stored,
  created_at     timestamptz not null default now()
);

-- Additive migration for a database created before step_widgets existed.
-- `create table if not exists` above is a no-op once the table already
-- exists, so existing installs need this run explicitly in the SQL editor.
alter table public.pathway_sessions
  add column if not exists step_widgets jsonb not null default '{}'::jsonb;

create index if not exists pathway_sessions_student_idx
  on public.pathway_sessions (student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- interactions — APPEND ONLY event stream. Never updated, never deleted.
-- ---------------------------------------------------------------------------
create table if not exists public.interactions (
  id                    bigserial primary key,
  session_id            uuid not null references public.pathway_sessions (id) on delete cascade,
  student_id            uuid not null references public.students (id) on delete cascade,
  widget_kind           text not null,
  event_type            text not null,
  standard_code         text,
  learning_component_id text,
  elapsed_ms            integer not null check (elapsed_ms >= 0),
  correct               boolean,
  payload               jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists interactions_student_idx
  on public.interactions (student_id, created_at desc);
create index if not exists interactions_component_idx
  on public.interactions (student_id, learning_component_id)
  where learning_component_id is not null;

-- Append-only enforced by the database, not just by application convention.
create or replace function public.reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'interactions is append-only';
end;
$$;

drop trigger if exists interactions_no_update on public.interactions;
create trigger interactions_no_update
  before update or delete on public.interactions
  for each row execute function public.reject_mutation();

-- ---------------------------------------------------------------------------
-- student_profiles — the distilled view injected into the generator prompt
-- ---------------------------------------------------------------------------
create table if not exists public.student_profiles (
  student_id uuid primary key references public.students (id) on delete cascade,
  profile    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Mastery rollup, keyed by the graph's learning component ids. Doing this in
-- Postgres keeps profile recomputation cheap enough to run after every widget.
-- ---------------------------------------------------------------------------
create or replace view public.component_mastery_rollup as
select
  student_id,
  learning_component_id,
  standard_code,
  count(*) filter (where correct is not null)             as attempts,
  count(*) filter (where correct)                         as correct_count,
  count(*) filter (where event_type = 'hint_requested')   as hints,
  percentile_cont(0.5) within group (order by elapsed_ms) as median_elapsed_ms,
  max(created_at)                                         as last_seen_at
from public.interactions
where learning_component_id is not null
group by student_id, learning_component_id, standard_code;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Deny by default. Browser clients use the anon key and can only read their own
-- rows. Every write goes through a route handler using the service role key,
-- which bypasses RLS — so that key must never reach the browser.
-- ---------------------------------------------------------------------------
alter table public.students          enable row level security;
alter table public.pathway_sessions  enable row level security;
alter table public.interactions      enable row level security;
alter table public.student_profiles  enable row level security;

drop policy if exists students_self_read on public.students;
drop policy if exists sessions_self_read on public.pathway_sessions;
drop policy if exists interactions_self_read on public.interactions;
drop policy if exists profiles_self_read on public.student_profiles;

create policy students_self_read on public.students
  for select using (auth_user_id = auth.uid());

create policy sessions_self_read on public.pathway_sessions
  for select using (
    student_id in (select id from public.students where auth_user_id = auth.uid())
  );

create policy interactions_self_read on public.interactions
  for select using (
    student_id in (select id from public.students where auth_user_id = auth.uid())
  );

create policy profiles_self_read on public.student_profiles
  for select using (
    student_id in (select id from public.students where auth_user_id = auth.uid())
  );
