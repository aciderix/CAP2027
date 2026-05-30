-- Issue #9 — fetch-parrainages exige désormais une authentification.
-- Le job pg_cron 'parrainages-daily' doit donc envoyer le header
-- x-ingest-token, dont la valeur est lue au RUNTIME via
-- public.get_ingest_secret() (jamais stockée en clair dans
-- cron.job.command). Même schéma que rss-ingest-hourly /
-- notify-after-ingest-hourly (issue #7).
--
-- cron.schedule(jobname, ...) sur un job existant le met à jour en place.

select cron.schedule('parrainages-daily', '30 6 * * *', $job$
  select net.http_post(
    url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/fetch-parrainages',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-token', public.get_ingest_secret()),
    timeout_milliseconds := 60000
  ) as request_id;
$job$);
