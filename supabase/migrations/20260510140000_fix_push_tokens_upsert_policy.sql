-- The previous setup had two separate permissive policies (INSERT
-- and UPDATE), but PostgREST's upsert (INSERT ... ON CONFLICT DO
-- UPDATE) failed with "new row violates row-level security policy"
-- — Postgres apparently evaluates both policies' WITH CHECK in
-- parallel for the upsert path and at least one branch wasn't
-- accepting the row when the other was supposed to.
--
-- Replace with a single FOR ALL policy that covers every operation
-- from anon/authenticated. Tokens are FCM addresses with no auth
-- value on their own (sending requires the FCM service account
-- server-side), so exposing them via SELECT is fine.

drop policy if exists push_tokens_anon_upsert on public.push_tokens;
drop policy if exists push_tokens_anon_update on public.push_tokens;

create policy push_tokens_anon_all on public.push_tokens
  for all to anon, authenticated
  using (true) with check (true);
