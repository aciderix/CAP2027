-- Supabase flags the view as "UNRESTRICTED" because by default
-- Postgres views run SECURITY DEFINER (i.e. they bypass RLS on the
-- underlying tables). Flip it to SECURITY INVOKER so the view
-- respects the caller's policies — anon then only sees published
-- candidates' columns and the public-read parrainages rows.
alter view public.parrainages_latest set (security_invoker = true);

-- Explicit grants so reads from anon/authenticated continue to work
-- (Supabase usually grants these by default for public schema; this
-- is defensive against future grant defaults).
grant select on public.parrainages_latest to anon, authenticated;
