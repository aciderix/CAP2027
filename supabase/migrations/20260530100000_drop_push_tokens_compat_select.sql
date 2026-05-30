-- Retrait de la policy SELECT temporaire mise en place pour rester
-- rétrocompatible avec l'ancien client qui faisait
-- `from('push_tokens').upsert(...)` (l'INSERT...ON CONFLICT DO UPDATE
-- avait besoin de lire la ligne en conflit, donc d'un SELECT).
--
-- Tous les clients (web + APK) passent maintenant par le RPC
-- `register_push_token` SECURITY DEFINER, qui fait l'upsert côté serveur
-- avec les privilèges de service_role et n'a donc pas besoin de la policy
-- côté anon. Aucune SELECT côté client n'existe plus dans le code
-- (vérifié par grep sur src/ et admin/src/).
--
-- Le retrait restaure la posture "tokens push pas énumérables par les
-- anonymes" voulue par l'audit (#6/#10).

drop policy if exists push_tokens_compat_select_TEMP on public.push_tokens;
