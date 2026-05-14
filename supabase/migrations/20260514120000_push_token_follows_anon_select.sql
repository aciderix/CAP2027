-- PostgreSQL's INSERT ... ON CONFLICT DO UPDATE path requires the
-- caller to be able to SELECT the conflicting row (otherwise the
-- conflict-resolution check raises 42501). The supabase-js client uses
-- `.upsert(..., { onConflict: 'token,candidate_id' })`, which lands on
-- that path, so anon needs a permissive SELECT policy on the table.
--
-- Privacy trade-off: anyone holding the publishable key (which is
-- embedded in the APK) can now list every (fcm_token, candidate_id)
-- pair. FCM tokens are opaque per-device strings — not human-PII —
-- and the publishable key is the only required credential to write
-- to the table anyway. Acceptable for the current use case; if we
-- ever want to tighten this, the client should switch to a plain
-- INSERT (catching duplicate errors) so we can drop the SELECT
-- policy again.

drop policy if exists push_token_follows_anon_select on public.push_token_follows;
create policy push_token_follows_anon_select on public.push_token_follows
  for select to anon, authenticated using (true);

grant select on public.push_token_follows to anon, authenticated;
