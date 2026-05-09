-- Enable RLS on all tables
alter table public.parties enable row level security;
alter table public.themes enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_bio_sections enable row level security;
alter table public.candidate_proposals enable row level security;
alter table public.candidate_affairs enable row level security;
alter table public.candidate_news enable row level security;
alter table public.match_propositions enable row level security;
alter table public.candidate_positions enable row level security;

-- Reference tables: public read
create policy "parties_public_read" on public.parties
  for select to anon, authenticated using (true);

create policy "themes_public_read" on public.themes
  for select to anon, authenticated using (true);

-- Candidates: public read of published only
create policy "candidates_public_read" on public.candidates
  for select to anon, authenticated using (is_published = true);

-- Bio sections: read if parent candidate is published
create policy "candidate_bio_sections_public_read" on public.candidate_bio_sections
  for select to anon, authenticated using (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_bio_sections.candidate_id and c.is_published = true
    )
  );

-- Proposals
create policy "candidate_proposals_public_read" on public.candidate_proposals
  for select to anon, authenticated using (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_proposals.candidate_id and c.is_published = true
    )
  );

-- Affairs
create policy "candidate_affairs_public_read" on public.candidate_affairs
  for select to anon, authenticated using (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_affairs.candidate_id and c.is_published = true
    )
  );

-- News (candidate_id may be null for general news)
create policy "candidate_news_public_read" on public.candidate_news
  for select to anon, authenticated using (
    candidate_id is null
    or exists (
      select 1 from public.candidates c
      where c.id = candidate_news.candidate_id and c.is_published = true
    )
  );

-- Match propositions: public read of active
create policy "match_propositions_public_read" on public.match_propositions
  for select to anon, authenticated using (is_active = true);

-- Candidate positions: read if candidate is published
create policy "candidate_positions_public_read" on public.candidate_positions
  for select to anon, authenticated using (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_positions.candidate_id and c.is_published = true
    )
  );
