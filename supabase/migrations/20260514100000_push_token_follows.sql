-- Per-device follows mirror. Lets push-broadcast filter the token list
-- when a notification is candidate-specific (e.g. "Nouveau post de
-- Mélenchon"). Stays anonymous: keyed only on the FCM token, no
-- user_id, no email. Same trust model as push_tokens — the FCM token
-- is the implicit device bearer.

create table if not exists public.push_token_follows (
  token text not null references public.push_tokens(token) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (token, candidate_id)
);

create index if not exists push_token_follows_candidate_idx
  on public.push_token_follows(candidate_id);

alter table public.push_token_follows enable row level security;

-- Anyone (anon device) can register/remove their own follows. We don't
-- expose SELECT to anon: only service_role reads in the broadcast fn.
drop policy if exists push_token_follows_anon_insert on public.push_token_follows;
create policy push_token_follows_anon_insert on public.push_token_follows
  for insert to anon, authenticated with check (true);

drop policy if exists push_token_follows_anon_delete on public.push_token_follows;
create policy push_token_follows_anon_delete on public.push_token_follows
  for delete to anon, authenticated using (true);

grant insert, delete on public.push_token_follows to anon, authenticated;
