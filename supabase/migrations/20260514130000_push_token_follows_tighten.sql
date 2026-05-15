-- Client no longer uses upsert (plain INSERT, duplicates swallowed
-- client-side). Reverting SELECT and UPDATE permissions so the
-- publishable key only allows INSERT/DELETE — no listing of who
-- follows whom.

drop policy if exists push_token_follows_anon_select on public.push_token_follows;
drop policy if exists push_token_follows_anon_update on public.push_token_follows;

revoke select, update on public.push_token_follows from anon, authenticated;
