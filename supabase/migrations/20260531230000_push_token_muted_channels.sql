-- Préférences par CANAL de notification, par device (token).
--
-- L'utilisateur peut couper certains canaux de notifs depuis les
-- Réglages. Modèle OPT-OUT (lenient): un device SANS ligne reçoit tout
-- (comportement historique préservé). Une ligne (token, channel) =
-- ce canal est COUPÉ pour ce device.
--
-- Canaux mutables:
--   news_press         -> notifs "N nouvelles actualités" (article_press)
--   candidates_followed-> posts/vidéos des candidats suivis (article_social)
--   candidates_updates -> maj candidats, programmes, propositions
--                         (candidate_updated, new_programme,
--                          candidate_published, match_proposition_change)
--
-- Les rappels électoraux (election_milestone, date_official,
-- election_results_published, parrainages_update) ne sont PAS mutables —
-- ils passent toujours (choix produit: échéances civiques importantes).
--
-- Même architecture que push_token_orientations: INSERT direct par anon
-- (pour couper un canal), DELETE via RPC SECURITY DEFINER (pour réactiver),
-- car sans policy SELECT un DELETE anon matche 0 ligne sous RLS.

create table if not exists public.push_token_muted_channels (
  token text not null references public.push_tokens(token) on delete cascade,
  channel text not null,
  created_at timestamptz not null default now(),
  primary key (token, channel)
);

create index if not exists push_token_muted_channels_channel_idx
  on public.push_token_muted_channels(channel);

alter table public.push_token_muted_channels enable row level security;

drop policy if exists push_token_muted_channels_anon_insert on public.push_token_muted_channels;
create policy push_token_muted_channels_anon_insert on public.push_token_muted_channels
  for insert to anon, authenticated with check (true);

drop policy if exists push_token_muted_channels_anon_delete on public.push_token_muted_channels;
create policy push_token_muted_channels_anon_delete on public.push_token_muted_channels
  for delete to anon, authenticated using (true);

grant insert, delete on public.push_token_muted_channels to anon, authenticated;

-- Réactiver un canal (supprime la ligne "muted"). SECURITY DEFINER pour
-- contourner l'absence de policy SELECT (même raison que unfollow_orientation).
create or replace function public.unmute_channel(p_token text, p_channel text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_token_muted_channels
  where token = p_token and channel = p_channel;
end;
$$;

grant execute on function public.unmute_channel(text, text) to anon, authenticated;
