-- publish_candidates() n'active plus que les sources X récupérées par le
-- workflow GitHub (fetch_via_github) : une ancienne source désactivée exprès
-- (ex. l'ancien flux xcancel de Mélenchon) reste éteinte.

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
     and fetch_via_github
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
