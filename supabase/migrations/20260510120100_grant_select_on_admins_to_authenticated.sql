-- The admins table was created without granting any role-level
-- privileges to `authenticated`, so PostgREST returned 403 to the
-- admin console before even evaluating the RLS policy
-- `admins_self_read`. RLS without a corresponding GRANT is a no-op
-- (Postgres requires both gates to pass).
grant select on public.admins to authenticated;
