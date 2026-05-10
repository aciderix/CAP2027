-- FCM is back as the primary "wakeup" mechanism (the WorkManager
-- background runner stays as a fallback for users where FCM is
-- unreachable, e.g. Huawei without GMS).
--
-- The token table is intentionally minimal: no user_id linkage, no
-- per-user state. The app is account-less; broadcasts go to all
-- registered tokens and the device decides locally what to display.

create table if not exists public.push_tokens (
  token text primary key,
  platform text not null,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

-- Anyone can register/refresh their own token (no user identity). The
-- column is the PK so duplicates upsert by (token). We don't expose
-- a SELECT to anon/authenticated — only service_role reads it from
-- the push-broadcast edge function.
drop policy if exists push_tokens_anon_upsert on public.push_tokens;
create policy push_tokens_anon_upsert on public.push_tokens
  for insert to anon, authenticated with check (true);

drop policy if exists push_tokens_anon_update on public.push_tokens;
create policy push_tokens_anon_update on public.push_tokens
  for update to anon, authenticated using (true) with check (true);

grant insert, update on public.push_tokens to anon, authenticated;
