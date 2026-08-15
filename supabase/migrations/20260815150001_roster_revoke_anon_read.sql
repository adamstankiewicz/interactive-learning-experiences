-- ---------------------------------------------------------------------------
-- Revoke the anon/authenticated read grant on the roster tables.
--
-- `20260815120000_roster.sql` granted `select` to anon and authenticated with
-- the comment "so the student homepage can load". It does not need it: every
-- read goes through service-role API routes, and service_role bypasses RLS.
--
-- Those grants are inert today only because RLS is enabled on both tables with
-- no policies, which denies everything. That is a fail-closed accident rather
-- than a design: the moment anyone adds `create policy ... using (true)`, the
-- grant turns into a public read of the whole roster - including the free-text
-- `adaptations` column, which the UI solicits IEP and accommodation notes into
-- - through the client-visible anon key.
--
-- Removing the grant means the policy and the grant both have to be added
-- deliberately before any of that data is reachable without the service role.
-- ---------------------------------------------------------------------------

revoke select on public.roster_students from anon, authenticated;
revoke select on public.assignments from anon, authenticated;
