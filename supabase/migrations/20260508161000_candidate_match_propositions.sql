-- Replace the shared-propositions model with per-candidate propositions.
-- Each row is a statement attributed to one candidate; the user's swipe
-- (pour/contre/neutre) is scored directly as +1/0/-1 against the candidate.

drop table if exists public.candidate_positions cascade;
drop table if exists public.match_propositions cascade;
drop type if exists match_stance;

create table public.candidate_match_propositions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete restrict,
  text text not null,
  is_active boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cmp_candidate_id_idx on public.candidate_match_propositions(candidate_id);
create index cmp_theme_id_idx on public.candidate_match_propositions(theme_id);
create index cmp_active_idx on public.candidate_match_propositions(is_active);

create trigger cmp_updated_at before update on public.candidate_match_propositions
  for each row execute function public.set_updated_at();

alter table public.candidate_match_propositions enable row level security;

create policy "cmp_public_read" on public.candidate_match_propositions
  for select to anon, authenticated using (
    is_active = true
    and exists (
      select 1 from public.candidates c
      where c.id = candidate_match_propositions.candidate_id and c.is_published = true
    )
  );
