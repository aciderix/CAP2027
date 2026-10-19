-- ingest-rss traite désormais les sources par lots de 12 (les moins
-- récemment lues d'abord) : un seul appel pour toutes les sources dépassait
-- la limite de calcul des fonctions (WORKER_RESOURCE_LIMIT). Le cron passe
-- toutes les 10 min (lots de 12) pour que chaque source reste lue environ une fois par
-- heure. Le nom du job est conservé. Déjà appliqué en prod.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'rss-ingest-hourly'),
  schedule := '*/10 * * * *'
);
