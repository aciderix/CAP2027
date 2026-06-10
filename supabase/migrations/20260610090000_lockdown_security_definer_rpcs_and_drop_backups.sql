-- Sécurité (audit prod 2026-06-10)
--
-- 1) Verrouillage des RPC SECURITY DEFINER qui ne doivent JAMAIS être
--    appelées depuis un client (clé anon/authenticated embarquée dans
--    l'app et le web). Elles restent appelables par service_role (edge
--    functions) et par les triggers internes (eux-mêmes SECURITY DEFINER
--    propriété de postgres, donc l'exécution est évaluée en tant que
--    postgres et n'est pas affectée par ces REVOKE).
--
--    - tokens_for_press_orientation(s): renvoyaient la liste des push
--      tokens des appareils -> fuite de données personnelles. Seul
--      appelant légitime: edge function push-broadcast (service_role).
--    - reschedule_election_reminders / _schedule_election_milestone:
--      manipulent les jobs pg_cron. Appelées uniquement par le trigger
--      _app_config_election_trigger (admin édite app_config) et par
--      service_role. Aucun usage client.
--
-- 2) Suppression de 4 tables de backup laissées par la migration du
--    31/05 (RLS désactivée -> exposées via PostgREST, advisor ERROR).
--    Non référencées par le code.

-- 1) RPC ------------------------------------------------------------------

revoke execute on function public.tokens_for_press_orientation(text)   from public, anon, authenticated;
revoke execute on function public.tokens_for_press_orientations(text[]) from public, anon, authenticated;
revoke execute on function public.reschedule_election_reminders()       from public, anon, authenticated;
revoke execute on function public._schedule_election_milestone(text, text, timestamptz) from public, anon, authenticated;

-- service_role conserve son grant explicite; on le réaffirme par sûreté.
grant execute on function public.tokens_for_press_orientation(text)   to service_role;
grant execute on function public.tokens_for_press_orientations(text[]) to service_role;
grant execute on function public.reschedule_election_reminders()       to service_role;
grant execute on function public._schedule_election_milestone(text, text, timestamptz) to service_role;

-- 2) Tables de backup -----------------------------------------------------

drop table if exists public.theme_keywords_backup_20260531b;
drop table if exists public.theme_keywords_backup_20260531;
drop table if exists public.themes_backup_20260531;
drop table if exists public.cron_jobs_backup_20260531;
