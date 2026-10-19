-- Publication groupée de fiches candidats, avec une seule notification.
--
-- Publier une fiche déclenche trg_candidates_notify, qui envoie un push
-- « Nouveau candidat publié » par fiche. Pour publier plusieurs fiches d'un
-- coup, publish_candidates() pose le réglage local de transaction
-- cap.quiet_publish, que le trigger respecte, puis envoie un push unique.
-- Elle active aussi les sources X (kind = twitter) des fiches publiées,
-- créées désactivées pour que leurs posts n'apparaissent pas avant la fiche.
-- Les fiches au statut « withdrawn » ne sont jamais publiées par ce biais.
--
-- Réservée au service role (appel depuis l'éditeur SQL ou un script
-- d'administration) : aucun droit pour anon ni authenticated.

create or replace function public.notify_candidate_published()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  push_secret constant text := public.get_push_broadcast_secret();
  title text;
  body text;
  is_new_publication boolean;
begin
  is_new_publication := (TG_OP = 'INSERT' and NEW.is_published = true)
    or (TG_OP = 'UPDATE' and coalesce(OLD.is_published, false) = false and NEW.is_published = true);
  if is_new_publication then
    perform public._bump_admin_change_counter();
    -- Publication groupée : publish_candidates() envoie son propre push.
    if coalesce(current_setting('cap.quiet_publish', true), '') = 'on' then
      return NEW;
    end if;
    title := 'Nouveau candidat publié : ' || trim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,''));
    body := 'Découvrez sa fiche dans CAP 2027.';
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','x-push-token', push_secret),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'candidate_published')
    );
  end if;
  return NEW;
end;
$function$;

create or replace function public.publish_candidates(
  p_slugs text[],
  p_title text default null,
  p_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  published uuid[];
  names text[];
  sources int;
  title text;
  body text;
begin
  perform set_config('cap.quiet_publish', 'on', true);

  with u as (
    update public.candidates
       set is_published = true
     where slug = any(p_slugs)
       and not is_published
       and status <> 'withdrawn'
    returning id, trim(first_name || ' ' || last_name) as full_name
  )
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(full_name order by full_name), '{}')
    into published, names
    from u;

  update public.news_sources
     set is_active = true
   where kind = 'twitter'
     and not is_active
     and candidate_id = any(published);
  get diagnostics sources = row_count;

  perform set_config('cap.quiet_publish', 'off', true);

  if cardinality(published) > 0 then
    title := coalesce(p_title, case when cardinality(published) = 1
      then 'Nouveau candidat publié : ' || names[1]
      else cardinality(published) || ' nouveaux candidats dans CAP 2027' end);
    body := coalesce(p_body, case when cardinality(published) = 1
      then 'Découvrez sa fiche dans CAP 2027.'
      else 'Découvrez leurs fiches : biographie, programme, affaires et actualités.' end);
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','x-push-token', public.get_push_broadcast_secret()),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'candidate_published')
    );
  end if;

  return jsonb_build_object(
    'published', cardinality(published),
    'names', to_jsonb(names),
    'x_sources_activated', sources,
    'skipped', (select coalesce(jsonb_agg(s.wanted), '[]'::jsonb) from unnest(p_slugs) as s(wanted)
                 where not exists (select 1 from public.candidates c where c.slug = s.wanted and c.id = any(published)))
  );
end;
$function$;

revoke all on function public.publish_candidates(text[], text, text) from public, anon, authenticated;
grant execute on function public.publish_candidates(text[], text, text) to service_role;
