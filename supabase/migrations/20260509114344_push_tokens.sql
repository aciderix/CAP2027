-- Stores anonymous device tokens for FCM. No user identifier is ever
-- linked to a token: anonymous push only, the way the rest of the app
-- stays anonymous.
create table if not exists public.push_tokens (
  token text primary key,
  platform text not null check (platform in ('android', 'ios', 'web')),
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

-- Anyone can insert / update their own token (no PK collision possible
-- without owning the device that minted the token in the first place,
-- so this is effectively safe).
drop policy if exists "push_tokens_upsert" on public.push_tokens;
create policy "push_tokens_upsert" on public.push_tokens
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "push_tokens_update" on public.push_tokens;
create policy "push_tokens_update" on public.push_tokens
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- Reading is restricted to the service role (used by the broadcast
-- edge function). Clients should NOT enumerate tokens.
revoke select on public.push_tokens from anon, authenticated;

create index if not exists idx_push_tokens_platform on public.push_tokens (platform);

-- Logs each broadcast attempt so we can observe delivery without
-- relying solely on FCM's dashboard.
create table if not exists public.push_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text,
  payload jsonb,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.push_broadcasts enable row level security;
revoke all on public.push_broadcasts from anon, authenticated;
