-- Source 'jean-luc-melenchon' (twitter, fetched via GitHub Actions)
-- was missing its candidate_id link, which prevented notify-after-ingest
-- from recognising new posts as belonging to Mélenchon.
update public.news_sources
set candidate_id = (select id from public.candidates where slug = 'jean-luc-melenchon')
where slug = 'jean-luc-melenchon' and candidate_id is null;
