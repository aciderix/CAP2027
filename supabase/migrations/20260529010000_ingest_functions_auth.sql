-- Issue #7: authenticate the ingest-rss and notify-after-ingest edge
-- functions. They are destructive (?retag=true wipes all article tags;
-- notify-after-ingest can replay notifications) and were callable by
-- anyone with the project URL. A shared secret (Vault: ingest_secret) is
-- sent by the cron jobs as the x-ingest-token header; the functions
-- reject calls carrying neither this header nor the service-role bearer.
--
-- NOTE: the Vault secret 'ingest_secret' must exist before replaying on a
-- fresh database:
--   select vault.create_secret('<secret>', 'ingest_secret', '...');

-- Helper: read the shared secret from Vault. SECURITY DEFINER, restricted
-- to service_role (used by the edge functions to validate the header) and
-- callable by the cron job owner at runtime.
CREATE OR REPLACE FUNCTION public.get_ingest_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'vault', 'public'
AS $function$
  SELECT decrypted_secret::text
  FROM vault.decrypted_secrets
  WHERE name = 'ingest_secret'
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_ingest_secret() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ingest_secret() TO service_role;

-- Reschedule both cron jobs to forward the secret in the x-ingest-token
-- header. cron.schedule overwrites the existing job of the same name;
-- schedule and timeout are preserved exactly as the prior definitions.
-- get_ingest_secret() is resolved at run time so the secret is never
-- stored in cron.job.command.
select cron.schedule(
  'rss-ingest-hourly',
  '15 * * * *',
  $job$
  select net.http_post(
    url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/ingest-rss',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-token', public.get_ingest_secret()),
    timeout_milliseconds := 240000
  ) as request_id;
  $job$
);

select cron.schedule(
  'notify-after-ingest-hourly',
  '16 * * * *',
  $job$
  select net.http_post(
    url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/notify-after-ingest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-token', public.get_ingest_secret()),
    timeout_milliseconds := 60000
  ) as request_id;
  $job$
);
