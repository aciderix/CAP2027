-- Election results: vote counts per candidate per round, entered manually
-- by an admin from the Admin Console.
--
-- Workflow:
--   1. Admin creates rows in election_results for each candidate (percentage,
--      votes, is_qualified for round 1, is_winner for round 2).
--   2. Admin clicks "Publier les résultats du Xer tour" which calls
--      publish_round_results(X). That RPC flips the app_config flag AND
--      auto-unpublishes candidates that didn't qualify (round 1) / didn't
--      win (round 2). They disappear from every public list via the
--      existing is_published=true RLS filter — zero changes to query sites.
--   3. The election_results_full view bypasses candidates RLS so the
--      results card / list still shows scores for unpublished candidates.
--   4. notify_election_results_published broadcasts a push when the
--      flag flips false→true.
--
-- Reversible: republish_round_candidates(X) re-publishes every candidate
-- that has a row in election_results for that round (safety net for an
-- accidental publish).

create table public.election_results (
  round int not null check (round in (1, 2)),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  percentage numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  votes bigint check (votes is null or votes >= 0),
  is_qualified boolean not null default false,
  is_winner boolean not null default false,
  rank int check (rank is null or rank > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (round, candidate_id)
);

create index election_results_round_idx on public.election_results(round);

create trigger election_results_updated_at
  before update on public.election_results
  for each row execute function public.set_updated_at();

alter table public.election_results enable row level security;

create policy "election_results_public_read"
  on public.election_results for select
  to anon, authenticated
  using (true);

create policy "election_results_admin_write"
  on public.election_results for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- RPC returning candidate display info joined to results. SECURITY DEFINER
-- so it bypasses the candidates is_published filter — eliminated candidates
-- still surface in the results card/list even after publish_round_results
-- flips their is_published to false.
create or replace function public.get_election_results_for_round(p_round int)
returns table (
  round int,
  candidate_id uuid,
  percentage numeric(5,2),
  votes bigint,
  is_qualified boolean,
  is_winner boolean,
  rank int,
  first_name text,
  last_name text,
  photo_url text,
  slug text,
  gender bpchar,
  party_name text,
  party_abbreviation text,
  party_color text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.round, r.candidate_id, r.percentage, r.votes,
    r.is_qualified, r.is_winner, r.rank,
    c.first_name, c.last_name, c.photo_url, c.slug, c.gender,
    p.name as party_name, p.abbreviation as party_abbreviation, p.color as party_color
  from public.election_results r
  join public.candidates c on c.id = r.candidate_id
  left join public.parties p on p.id = c.party_id
  where r.round = p_round
  order by r.percentage desc nulls last, r.rank asc nulls last;
$$;

grant execute on function public.get_election_results_for_round(int) to anon, authenticated;

-- Feature flag: controls when the results card/page becomes visible
insert into public.app_config (key, value)
values ('election.results', jsonb_build_object(
  'round1_published', false,
  'round2_published', false
))
on conflict (key) do nothing;

-- Atomic publish: flip the flag + auto-unpublish losers.
-- Round 1: candidates with is_qualified=false get is_published=false.
-- Round 2: candidates with is_winner=false get is_published=false.
create or replace function public.publish_round_results(p_round int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur jsonb;
  flag_key text;
begin
  if not coalesce(public.is_admin(auth.uid()), false) then
    raise exception 'Forbidden: admin only';
  end if;
  if p_round not in (1, 2) then
    raise exception 'Invalid round: %', p_round;
  end if;

  flag_key := case p_round when 1 then 'round1_published' else 'round2_published' end;

  select value into cur from public.app_config where key = 'election.results';
  if cur is null then
    cur := jsonb_build_object('round1_published', false, 'round2_published', false);
  end if;
  cur := jsonb_set(cur, array[flag_key], 'true'::jsonb, true);
  insert into public.app_config (key, value)
  values ('election.results', cur)
  on conflict (key) do update set value = excluded.value, updated_at = now();

  if p_round = 1 then
    update public.candidates c
      set is_published = false
      where c.is_published = true
        and exists (
          select 1 from public.election_results r
          where r.candidate_id = c.id and r.round = 1 and r.is_qualified = false
        );
  else
    update public.candidates c
      set is_published = false
      where c.is_published = true
        and exists (
          select 1 from public.election_results r
          where r.candidate_id = c.id and r.round = 2 and r.is_winner = false
        );
  end if;
end;
$$;

grant execute on function public.publish_round_results(int) to authenticated;

-- Safety net: re-publish every candidate with a row in election_results
-- for the given round. Also flips the round flag back to false so the
-- public stops seeing the results until admin re-publishes.
create or replace function public.unpublish_round_results(p_round int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur jsonb;
  flag_key text;
begin
  if not coalesce(public.is_admin(auth.uid()), false) then
    raise exception 'Forbidden: admin only';
  end if;
  if p_round not in (1, 2) then
    raise exception 'Invalid round: %', p_round;
  end if;

  flag_key := case p_round when 1 then 'round1_published' else 'round2_published' end;

  select value into cur from public.app_config where key = 'election.results';
  if cur is null then
    cur := jsonb_build_object('round1_published', false, 'round2_published', false);
  end if;
  cur := jsonb_set(cur, array[flag_key], 'false'::jsonb, true);
  update public.app_config set value = cur, updated_at = now() where key = 'election.results';

  update public.candidates c
    set is_published = true
    where exists (
      select 1 from public.election_results r
      where r.candidate_id = c.id and r.round = p_round
    );
end;
$$;

grant execute on function public.unpublish_round_results(int) to authenticated;

-- Push notification when results are published.
create or replace function public.notify_election_results_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  winner_name text;
  title text;
  body constant text := 'Découvrez les scores dans CAP 2027.';
begin
  if NEW.key <> 'election.results' then
    return NEW;
  end if;

  if coalesce((OLD.value->>'round1_published')::boolean, false) = false
     and (NEW.value->>'round1_published')::boolean = true then
    title := 'Résultats du 1er tour disponibles';
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'election_results_published')
    );
  end if;

  if coalesce((OLD.value->>'round2_published')::boolean, false) = false
     and (NEW.value->>'round2_published')::boolean = true then
    select trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,''))
      into winner_name
      from public.election_results r
      join public.candidates c on c.id = r.candidate_id
      where r.round = 2 and r.is_winner = true
      limit 1;

    title := case when winner_name is not null and length(winner_name) > 0
                  then winner_name || ' élu·e président·e'
                  else 'Résultats du 2nd tour disponibles'
             end;
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'election_results_published')
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_app_config_results_notify on public.app_config;
create trigger trg_app_config_results_notify
  after insert or update on public.app_config
  for each row execute function public.notify_election_results_published();
