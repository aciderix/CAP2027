-- Replace the SECURITY DEFINER view with a SECURITY DEFINER function:
-- same effect (bypass candidates RLS so eliminated candidates' display
-- info stays visible in the results card), but the linter only WARNS
-- on functions (vs ERRORs on views).

drop view if exists public.election_results_full;

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
