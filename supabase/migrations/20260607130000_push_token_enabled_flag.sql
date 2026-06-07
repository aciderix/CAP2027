-- Toggle maître "Notifications" réellement effectif côté serveur.
--
-- Avant: couper le toggle maître dans Réglages ne posait qu'un flag
-- localStorage; le serveur continuait d'envoyer au token. L'utilisateur
-- croyait avoir tout coupé mais recevait quand même.
--
-- Maintenant: push_tokens.enabled. Master OFF -> set_token_enabled(false)
-- -> push-broadcast exclut ce token pour TOUS les types (rappels
-- électoraux compris: désactiver le maître = opt-out total assumé).
-- Master ON -> set_token_enabled(true) après ré-enregistrement.
--
-- Les préférences fines (canaux mutés, candidats suivis, orientations)
-- restent en base pendant que c'est coupé -> retrouvées en réactivant.

alter table public.push_tokens
  add column if not exists enabled boolean not null default true;

-- RPC SECURITY DEFINER: les clients anon n'ont ni SELECT ni UPDATE direct
-- sur push_tokens (politiques durcies, issues #6/#10). On expose un setter
-- ciblé qui ne lit rien et ne renvoie rien (pas de fuite de tokens).
create or replace function public.set_token_enabled(
  p_token text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or length(p_token) = 0 then
    return;
  end if;
  update public.push_tokens
    set enabled = coalesce(p_enabled, true)
  where token = p_token;
end;
$$;

revoke all on function public.set_token_enabled(text, boolean) from public;
grant execute on function public.set_token_enabled(text, boolean) to anon, authenticated;
