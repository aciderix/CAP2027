-- Lien automatique fiche CAP 2027 ↔ candidat Demos Kratos dès qu'une fiche est
-- créée ou que son slug change (jusqu'ici : seulement au prochain import).
-- Même règle que dk_import : même slug. N'écrit que dans dk_candidate_links,
-- jamais dans candidates, donc aucune notification.
create or replace function public.dk_link_candidate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_dk text;
begin
  select id into v_dk from (
    select id from public.dk_candidates where slug = NEW.slug
    union all
    select id from public.dk_match_candidates where slug = NEW.slug
  ) d limit 1;
  if v_dk is null then
    return NEW;
  end if;

  -- Un candidat DK n'est relié qu'à une fiche (dk_candidate_id unique) : si
  -- une autre fiche l'a déjà, on ne touche à rien.
  insert into public.dk_candidate_links (candidate_id, dk_candidate_id)
  select NEW.id, v_dk
  where not exists (
    select 1 from public.dk_candidate_links
    where dk_candidate_id = v_dk and candidate_id <> NEW.id
  )
  on conflict (candidate_id) do update set dk_candidate_id = excluded.dk_candidate_id;
  return NEW;
end;
$$;

revoke all on function public.dk_link_candidate() from public, anon, authenticated;

create trigger trg_candidates_dk_link
  after insert or update of slug on public.candidates
  for each row execute function public.dk_link_candidate();
