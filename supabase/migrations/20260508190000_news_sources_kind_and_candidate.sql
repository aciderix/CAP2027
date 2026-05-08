-- Étendre les sources pour couvrir presse + réseaux sociaux candidat
alter table public.news_sources
  add column kind text not null default 'press',
  add column candidate_id uuid references public.candidates(id) on delete set null;

alter table public.news_articles
  add column kind text not null default 'article';

create index news_sources_kind_idx on public.news_sources(kind);
create index news_sources_candidate_idx on public.news_sources(candidate_id);
create index news_articles_kind_idx on public.news_articles(kind);

-- Démo YouTube (pas attaché à un candidat fictif - juste pour valider l'ingestion)
insert into public.news_sources (slug, name, homepage_url, rss_url, orientation, color, is_factcheck, kind)
values (
  'yt-jlmelenchon',
  'Jean-Luc Mélenchon (YouTube)',
  'https://www.youtube.com/@JLMelenchon',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCk-_PEY3iC6DIGJKuoEe9bw',
  'gauche',
  '#FF0000',
  false,
  'youtube'
);
