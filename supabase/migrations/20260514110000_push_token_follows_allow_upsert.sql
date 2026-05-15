-- The client uses upsert with onConflict=(token,candidate_id), which
-- PostgREST translates to INSERT ON CONFLICT DO UPDATE. That requires
-- both an UPDATE policy and an UPDATE table grant for anon. Without
-- them, anon hits a 401 before the RLS check even runs.

drop policy if exists push_token_follows_anon_update on public.push_token_follows;
create policy push_token_follows_anon_update on public.push_token_follows
  for update to anon, authenticated using (true) with check (true);

grant update on public.push_token_follows to anon, authenticated;
