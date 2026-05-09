-- Enums
create type candidate_status as enum ('declared', 'pressenti', 'withdrawn');
create type affair_status as enum ('mis_en_examen', 'en_cours', 'classee', 'condamnation', 'relaxe');
create type match_stance as enum ('pour', 'contre', 'neutre');

-- updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Parties
create table public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abbreviation text,
  color text,
  logo_url text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger parties_updated_at before update on public.parties
  for each row execute function public.set_updated_at();

-- Themes
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,
  color text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger themes_updated_at before update on public.themes
  for each row execute function public.set_updated_at();

-- Candidates
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  first_name text not null,
  last_name text not null,
  gender char(1) check (gender in ('M','F')),
  photo_url text,
  birth_date date,
  birth_place text,
  party_id uuid references public.parties(id) on delete set null,
  status candidate_status not null default 'pressenti',
  declared_at date,
  sponsorships_count int not null default 0,
  sponsorships_target int not null default 500,
  short_bio text,
  is_published boolean not null default false,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidates_party_id_idx on public.candidates(party_id);
create index candidates_is_published_idx on public.candidates(is_published);
create trigger candidates_updated_at before update on public.candidates
  for each row execute function public.set_updated_at();

-- Bio sections
create table public.candidate_bio_sections (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  title text not null,
  content text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidate_bio_sections_candidate_id_idx on public.candidate_bio_sections(candidate_id);
create trigger candidate_bio_sections_updated_at before update on public.candidate_bio_sections
  for each row execute function public.set_updated_at();

-- Proposals (programme par thème)
create table public.candidate_proposals (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete restrict,
  title text not null,
  content text,
  source_url text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidate_proposals_candidate_id_idx on public.candidate_proposals(candidate_id);
create index candidate_proposals_theme_id_idx on public.candidate_proposals(theme_id);
create trigger candidate_proposals_updated_at before update on public.candidate_proposals
  for each row execute function public.set_updated_at();

-- Affairs (affaires judiciaires)
create table public.candidate_affairs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  title text not null,
  description text,
  status affair_status not null default 'en_cours',
  date date,
  source_urls text[] not null default '{}',
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidate_affairs_candidate_id_idx on public.candidate_affairs(candidate_id);
create trigger candidate_affairs_updated_at before update on public.candidate_affairs
  for each row execute function public.set_updated_at();

-- News
create table public.candidate_news (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  title text not null,
  summary text,
  url text not null,
  source_name text,
  published_at timestamptz not null,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index candidate_news_candidate_id_idx on public.candidate_news(candidate_id);
create index candidate_news_published_at_idx on public.candidate_news(published_at desc);

-- Match propositions (libellés neutres)
create table public.match_propositions (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.themes(id) on delete restrict,
  text text not null,
  is_active boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index match_propositions_theme_id_idx on public.match_propositions(theme_id);
create index match_propositions_is_active_idx on public.match_propositions(is_active);
create trigger match_propositions_updated_at before update on public.match_propositions
  for each row execute function public.set_updated_at();

-- Candidate positions
create table public.candidate_positions (
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  proposition_id uuid not null references public.match_propositions(id) on delete cascade,
  stance match_stance not null,
  weight smallint not null default 1 check (weight between 1 and 5),
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (candidate_id, proposition_id)
);
create index candidate_positions_proposition_id_idx on public.candidate_positions(proposition_id);
create trigger candidate_positions_updated_at before update on public.candidate_positions
  for each row execute function public.set_updated_at();
