-- Sources de presse (RSS)
create table public.news_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  homepage_url text,
  rss_url text not null,
  orientation text not null,         -- gauche, centre, centre-droit, droite, transverse, factcheck
  color text,
  is_factcheck boolean not null default false,
  is_active boolean not null default true,
  last_fetched_at timestamptz,
  last_fetch_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger news_sources_updated_at before update on public.news_sources
  for each row execute function public.set_updated_at();

-- Articles d'actualité agrégés
create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.news_sources(id) on delete cascade,
  guid text not null,
  url text not null,
  title text not null,
  summary text,
  image_url text,
  author text,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  is_factcheck boolean not null default false,
  verdict text,
  unique (source_id, guid)
);
create index news_articles_published_idx on public.news_articles(published_at desc);
create index news_articles_factcheck_idx on public.news_articles(is_factcheck, published_at desc);
create index news_articles_source_idx on public.news_articles(source_id);

create table public.candidate_aliases (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now()
);
create index candidate_aliases_candidate_idx on public.candidate_aliases(candidate_id);
create index candidate_aliases_alias_lower_idx on public.candidate_aliases(lower(alias));

create table public.party_aliases (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now()
);
create index party_aliases_party_idx on public.party_aliases(party_id);
create index party_aliases_alias_lower_idx on public.party_aliases(lower(alias));

create table public.theme_keywords (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.themes(id) on delete cascade,
  keyword text not null,
  created_at timestamptz not null default now()
);
create index theme_keywords_theme_idx on public.theme_keywords(theme_id);
create index theme_keywords_keyword_lower_idx on public.theme_keywords(lower(keyword));

create table public.article_candidates (
  article_id uuid not null references public.news_articles(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  score int not null default 1,
  primary key (article_id, candidate_id)
);

create table public.article_parties (
  article_id uuid not null references public.news_articles(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  score int not null default 1,
  primary key (article_id, party_id)
);

create table public.article_themes (
  article_id uuid not null references public.news_articles(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  score int not null default 1,
  primary key (article_id, theme_id)
);

alter table public.news_sources enable row level security;
alter table public.news_articles enable row level security;
alter table public.candidate_aliases enable row level security;
alter table public.party_aliases enable row level security;
alter table public.theme_keywords enable row level security;
alter table public.article_candidates enable row level security;
alter table public.article_parties enable row level security;
alter table public.article_themes enable row level security;

create policy "news_sources_public_read" on public.news_sources
  for select to anon, authenticated using (is_active = true);
create policy "news_articles_public_read" on public.news_articles
  for select to anon, authenticated using (true);
create policy "candidate_aliases_public_read" on public.candidate_aliases
  for select to anon, authenticated using (true);
create policy "party_aliases_public_read" on public.party_aliases
  for select to anon, authenticated using (true);
create policy "theme_keywords_public_read" on public.theme_keywords
  for select to anon, authenticated using (true);
create policy "article_candidates_public_read" on public.article_candidates
  for select to anon, authenticated using (true);
create policy "article_parties_public_read" on public.article_parties
  for select to anon, authenticated using (true);
create policy "article_themes_public_read" on public.article_themes
  for select to anon, authenticated using (true);
