-- Some RSS endpoints (Le Figaro, X mirrors via nitter, etc.) block the
-- Supabase egress IP. We can't fetch them from the ingest-rss edge
-- function. As a workaround, a GitHub Actions cron (different IP pool)
-- fetches the XML and POSTs it to the new ingest-from-xml edge
-- function, which reuses the existing parsing/tagging/insert pipeline.
--
-- Sources flagged with this column are still visible to the app
-- (is_active=true) but ingest-rss skips them so we don't waste 30 s
-- per failed fetch every hour.
alter table public.news_sources
  add column if not exists fetch_via_github boolean not null default false;

create index if not exists news_sources_fetch_via_github_idx
  on public.news_sources(fetch_via_github)
  where fetch_via_github = true;
