-- Per-device subscription to press source orientations (gauche,
-- centre, centre-droit, droite, transverse, factcheck). Drives the
-- push-broadcast filter for "N nouvelles actualités" notifs.
--
-- Semantics: opt-in restrictif but with sane default.
--   - A device with NO rows in this table receives ALL press notifs.
--   - A device with rows receives only notifs whose source.orientation
--     matches one of its rows.
--
-- This way, a user who never touches the filter gets the legacy
-- behaviour (everything), but as soon as they pick at least one bord
-- in the feed UI, the push side aligns to their choice automatically.

create table if not exists public.push_token_orientations (
  token text not null references public.push_tokens(token) on delete cascade,
  orientation text not null,
  created_at timestamptz not null default now(),
  primary key (token, orientation)
);

create index if not exists push_token_orientations_orientation_idx
  on public.push_token_orientations(orientation);

alter table public.push_token_orientations enable row level security;

drop policy if exists push_token_orientations_anon_insert on public.push_token_orientations;
create policy push_token_orientations_anon_insert on public.push_token_orientations
  for insert to anon, authenticated with check (true);

drop policy if exists push_token_orientations_anon_delete on public.push_token_orientations;
create policy push_token_orientations_anon_delete on public.push_token_orientations
  for delete to anon, authenticated using (true);

grant insert, delete on public.push_token_orientations to anon, authenticated;

-- RPC used by push-broadcast to fan-out a press notif: returns every
-- token that should receive it given the opt-in restrictif rule above.
create or replace function public.tokens_for_press_orientation(orient text)
returns table(token text, platform text)
language sql
security definer
set search_path = public
as $$
  select t.token, t.platform
  from public.push_tokens t
  where not exists (
    select 1 from public.push_token_orientations o where o.token = t.token
  )
  or exists (
    select 1 from public.push_token_orientations o
    where o.token = t.token and o.orientation = orient
  )
$$;

grant execute on function public.tokens_for_press_orientation(text) to service_role;
