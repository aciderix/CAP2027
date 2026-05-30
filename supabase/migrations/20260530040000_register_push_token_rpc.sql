-- Issues #6/#10 — suite. La migration précédente a coupé le SELECT anon sur
-- push_tokens, ce qui casse le chemin ON CONFLICT DO UPDATE de l'upsert
-- (l'upsert PostgREST a besoin de relire la ligne en conflit). C'est le
-- seul écrivain de push_tokens : src/lib/push.ts.
--
-- Solution en 2 temps (transition sans casser l'APK déjà déployé) :
--   1. (ici) RPC SECURITY DEFINER register_push_token() qui fait l'upsert
--      côté serveur, en contournant la RLS proprement → cible finale.
--   2. (ici aussi, TEMPORAIRE) on réautorise le SELECT anon le temps que
--      l'APK encore en circulation (qui fait un upsert table direct)
--      continue de fonctionner. Cette policy SELECT sera RETIRÉE dans une
--      migration ultérieure, une fois l'APK rebuildé sur la RPC.
--
-- Aucune donnée touchée.

-- ── RPC d'upsert (cible finale, appelée par le futur push.ts) ──────────────
create or replace function public.register_push_token(
  p_token       text,
  p_platform    text,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or length(p_token) = 0 then
    raise exception 'token required';
  end if;
  insert into public.push_tokens (token, platform, app_version, last_seen_at)
  values (p_token, coalesce(p_platform, 'unknown'), p_app_version, now())
  on conflict (token) do update
    set platform     = excluded.platform,
        app_version  = excluded.app_version,
        last_seen_at  = now();
end;
$$;

-- Exécutable par les clients (anon + authenticated). La fonction ne lit
-- jamais et ne renvoie rien : pas de fuite de tokens.
revoke all on function public.register_push_token(text, text, text) from public;
grant execute on function public.register_push_token(text, text, text) to anon, authenticated;

-- ── Policy SELECT TEMPORAIRE (compat APK en circulation) ───────────────────
-- À SUPPRIMER une fois l'APK rebuildé sur register_push_token().
-- Nommée explicitement pour être retirée sans ambiguïté.
create policy push_tokens_compat_select_TEMP on public.push_tokens
  as permissive for select to anon, authenticated
  using (true);
