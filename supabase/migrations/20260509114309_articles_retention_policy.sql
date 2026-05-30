-- Tiered retention policy. Run monthly. Keeps the database lean
-- without losing the politically meaningful history.
--
--   Tier A (kept forever):  articles tagged with a published candidate
--                           via article_candidates. These power the
--                           candidate fiche "Actualités" history.
--
--   Tier B (12 months):     fact-check articles. They remain referenceable
--                           ("vérifié en mars 2026, toujours faux") but
--                           their long-term value tapers off.
--
--   Tier C (3 months):      everything else. Generic press articles not
--                           attached to any candidate are mostly noise
--                           (unrelated foreign elections, local politics
--                           with no national resonance, etc).

create or replace function public.purge_old_articles()
returns table (deleted_total int, deleted_factcheck int, deleted_orphan int)
language plpgsql
security definer
as $$
declare
  v_factcheck int := 0;
  v_orphan    int := 0;
begin
  -- Tier B: delete fact-checks older than 12 months
  with deleted as (
    delete from public.news_articles
    where is_factcheck = true
      and published_at < now() - interval '12 months'
    returning 1
  )
  select count(*) into v_factcheck from deleted;

  -- Tier C: delete press articles older than 3 months that are NOT
  -- attached to any candidate (i.e. not in article_candidates)
  with deleted as (
    delete from public.news_articles a
    where a.is_factcheck = false
      and a.published_at < now() - interval '3 months'
      and not exists (
        select 1 from public.article_candidates ac
        where ac.article_id = a.id
      )
    returning 1
  )
  select count(*) into v_orphan from deleted;

  return query select (v_factcheck + v_orphan)::int, v_factcheck, v_orphan;
end;
$$;

-- Keep only the service role / postgres user able to call it directly
revoke execute on function public.purge_old_articles() from public;
revoke execute on function public.purge_old_articles() from anon, authenticated;

-- Schedule monthly: 1st of each month at 04:00 UTC. Logs go to cron.job_run_details.
select cron.schedule(
  'articles-retention-monthly',
  '0 4 1 * *',
  $$ select * from public.purge_old_articles(); $$
);
