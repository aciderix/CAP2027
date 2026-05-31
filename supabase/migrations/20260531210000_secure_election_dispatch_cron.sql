-- Sécurisation de dispatch-election-reminders: le cron interne forwarde
-- désormais le secret partagé `ingest_secret` (déjà en Vault, déjà utilisé
-- par ingest-rss et notify-after-ingest) dans le header `x-ingest-token`.
--
-- La fonction edge dispatch-election-reminders est mise à jour en parallèle
-- pour vérifier ce header — un appel sans header (ou avec mauvais token)
-- retournera 401.
--
-- Aucun changement de date, de milestone, ou de logique. Migration safe:
-- get_ingest_secret() est résolu au runtime, le secret n'est jamais
-- stocké en clair dans cron.job.command.
--
-- Backup pris: cron_jobs_backup_20260531 (12 lignes)

-- 1) Helper de planification (mise à jour: ajoute le header x-ingest-token)
CREATE OR REPLACE FUNCTION public._schedule_election_milestone(
  job_name text,
  milestone_qs text,
  target_ts timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  cron_expr text;
  url text;
  cmd text;
  utc_ts timestamp;
BEGIN
  IF target_ts IS NULL OR target_ts <= now() THEN
    RETURN;
  END IF;
  utc_ts := target_ts AT TIME ZONE 'UTC';
  cron_expr :=
    extract(minute FROM utc_ts)::int::text || ' ' ||
    extract(hour   FROM utc_ts)::int::text || ' ' ||
    extract(day    FROM utc_ts)::int::text || ' ' ||
    extract(month  FROM utc_ts)::int::text || ' *';
  url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/dispatch-election-reminders?milestone='
       || milestone_qs;
  -- Le header x-ingest-token est résolu à l'exécution via
  -- public.get_ingest_secret() ; le secret n'apparaît jamais dans
  -- cron.job.command. Même schéma que rss-ingest-hourly.
  cmd := format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-ingest-token'', public.get_ingest_secret()), timeout_milliseconds := 60000);',
    url
  );
  PERFORM cron.schedule(job_name, cron_expr, cmd);
END;
$$;

-- 2) Reprogrammer les 12 jobs avec le nouveau command (qui inclut le header).
--    reschedule_election_reminders() DROP puis recrée tous les jobs election_*.
SELECT public.reschedule_election_reminders();
