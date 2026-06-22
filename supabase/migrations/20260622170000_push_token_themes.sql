-- Filtrage des notifications par catégorie d'actualité (thème).
--
-- Calque EXACT de push_token_orientations (cf. migration push_token_orientations
-- + tokens_for_press_orientations_array + unfollow_rpcs_for_anon_delete +
-- lockdown_security_definer_rpcs) :
--   * opt-in restrictif mais lenient : aucune ligne pour un token => il
--     reçoit TOUTES les actualités (comportement historique préservé) ;
--     au moins une ligne => il ne reçoit que les notifs presse dont l'un
--     des thèmes est suivi.
--   * Source de vérité localStorage côté client ; ce miroir serveur permet
--     à push-broadcast de filtrer les notifs presse par thème suivi.
--   * RLS : INSERT seul pour anon/authenticated ; la suppression passe par
--     des RPC SECURITY DEFINER (pas de policy SELECT/DELETE => un DELETE
--     direct matche 0 ligne sous RLS, comme pour les orientations).
--
-- Le slug de thème stocké correspond à themes.slug (ex. 'institutions',
-- 'ecologie', 'economie'...). Idempotent.

create table if not exists public.push_token_themes (
  token      text not null,
  theme      text not null,
  created_at timestamptz not null default now(),
  primary key (token, theme)
);

create index if not exists push_token_themes_theme_idx
  on public.push_token_themes (theme);

alter table public.push_token_themes enable row level security;

-- Grants larges (comme push_token_orientations) ; c'est la RLS qui gate.
grant select, insert, update, delete on public.push_token_themes to anon, authenticated;

-- INSERT seul (anon + authenticated). Aucune policy SELECT/UPDATE/DELETE :
-- la suppression passe par les RPC ci-dessous.
drop policy if exists push_token_themes_anon_insert on public.push_token_themes;
create policy push_token_themes_anon_insert
  on public.push_token_themes
  for insert
  to anon, authenticated
  with check (true);

-- Suppression d'un thème suivi (mirror unfollow_orientation).
create or replace function public.unfollow_theme(p_token text, p_theme text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.push_token_themes
  where token = p_token and theme = p_theme;
end;
$$;

-- Vide tous les thèmes suivis d'un token (mirror clear_orientations).
create or replace function public.clear_themes(p_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.push_token_themes where token = p_token;
end;
$$;

-- EXECUTE PUBLIC pour les RPC de suppression (comme unfollow_orientation /
-- clear_orientations) : le client anon doit pouvoir les appeler.
grant execute on function public.unfollow_theme(text, text) to anon, authenticated;
grant execute on function public.clear_themes(text) to anon, authenticated;
