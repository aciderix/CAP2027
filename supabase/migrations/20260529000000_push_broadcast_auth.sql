-- Issue #5: authenticate net.http_post calls from DB triggers to the
-- push-broadcast edge function. A shared secret (Vault: push_broadcast_secret)
-- is sent as the x-push-token header. The edge function rejects requests
-- that carry neither this header nor the service-role bearer.
--
-- NOTE: the Vault secret 'push_broadcast_secret' must be created before
-- replaying this migration on a fresh database:
--   select vault.create_secret('<secret>', 'push_broadcast_secret', '...');

-- Helper: read the shared secret from Vault. SECURITY DEFINER so the
-- trigger functions (also SECURITY DEFINER, owned by postgres) can call
-- it without direct vault access.
CREATE OR REPLACE FUNCTION public.get_push_broadcast_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'vault', 'public'
AS $function$
  SELECT decrypted_secret::text
  FROM vault.decrypted_secrets
  WHERE name = 'push_broadcast_secret'
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_push_broadcast_secret() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_broadcast_secret() TO service_role;

-- ---- Recreate the 6 trigger functions adding the x-push-token header ----

CREATE OR REPLACE FUNCTION public.notify_app_config_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  push_secret constant text := public.get_push_broadcast_secret();
  title text;
  body text;
  round_label text;
begin
  if NEW.key in ('election.round1', 'election.round2') then
    if coalesce((OLD.value->>'is_official')::boolean, false) = false
       and (NEW.value->>'is_official')::boolean = true then
      round_label := case NEW.key when 'election.round1' then '1er' else '2nd' end;
      title := 'Date du scrutin officialisée';
      body := 'La date du ' || round_label || ' tour de l''élection présidentielle 2027 est désormais confirmée. Ouvrez CAP 2027 pour la consulter.';
      perform public._bump_admin_change_counter();
      perform net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','x-push-token', push_secret),
        body := jsonb_build_object('title', title, 'body', body, 'type', 'date_official')
      );
    end if;
  elsif NEW.key = 'parrainages.source' then
    if coalesce((OLD.value->>'is_available')::boolean, false) = false
       and (NEW.value->>'is_available')::boolean = true then
      title := 'Parrainages disponibles';
      body := 'Le compteur officiel des 500 signatures d''élus par candidat est désormais accessible dans l''app.';
      perform public._bump_admin_change_counter();
      perform net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','x-push-token', push_secret),
        body := jsonb_build_object('title', title, 'body', body, 'type', 'parrainages_update')
      );
    end if;
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_candidate_content_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  push_secret constant text := public.get_push_broadcast_secret();
  cand_id uuid;
  cand record;
  full_name text;
  theme_name text;
  title text;
  body constant text := 'Ouvrez CAP 2027 pour découvrir les nouveautés.';
  notif_type constant text := 'candidate_updated';
begin
  if TG_TABLE_NAME = 'candidates' then
    cand_id := NEW.id;
  else
    cand_id := NEW.candidate_id;
  end if;

  select first_name, last_name, is_published
    into cand
    from public.candidates where id = cand_id;
  if cand is null or coalesce(cand.is_published, false) = false then
    return NEW;
  end if;

  full_name := trim(coalesce(cand.first_name,'') || ' ' || coalesce(cand.last_name,''));

  if TG_TABLE_NAME = 'candidates' then
    if coalesce(OLD.is_published, false) = false and NEW.is_published = true then
      return NEW;
    end if;
    if NEW.short_bio is distinct from OLD.short_bio then
      title := 'Bio courte mise à jour : ' || full_name;
    else
      return NEW;
    end if;

  elsif TG_TABLE_NAME = 'candidate_bio_sections' then
    if TG_OP = 'INSERT' then
      title := 'Nouvelle section biographique : ' || full_name;
    elsif (NEW.title is distinct from OLD.title)
       or (NEW.content is distinct from OLD.content) then
      title := 'Biographie mise à jour : ' || full_name;
    else
      return NEW;
    end if;

  elsif TG_TABLE_NAME = 'candidate_proposals' then
    select name into theme_name from public.themes where id = NEW.theme_id;
    if TG_OP = 'INSERT' then
      title := 'Nouvelle proposition (' || coalesce(theme_name, 'thématique') || ') : ' || full_name;
    elsif (NEW.title is distinct from OLD.title)
       or (NEW.content is distinct from OLD.content)
       or (NEW.source_url is distinct from OLD.source_url)
       or (NEW.theme_id is distinct from OLD.theme_id) then
      title := 'Proposition mise à jour (' || coalesce(theme_name, 'thématique') || ') : ' || full_name;
    else
      return NEW;
    end if;

  elsif TG_TABLE_NAME = 'candidate_affairs' then
    if TG_OP = 'INSERT' then
      title := 'Nouvelle affaire concernant ' || full_name;
    elsif (NEW.title is distinct from OLD.title)
       or (NEW.description is distinct from OLD.description)
       or (NEW.status is distinct from OLD.status)
       or (NEW.date is distinct from OLD.date)
       or (NEW.source_urls is distinct from OLD.source_urls) then
      title := 'Affaire mise à jour : ' || full_name;
    else
      return NEW;
    end if;

  else
    return NEW;
  end if;

  perform public._bump_admin_change_counter();
  perform net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type','application/json','x-push-token', push_secret),
    body := jsonb_build_object('title', title, 'body', body, 'type', notif_type)
  );
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_candidate_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    title := 'Nouveau candidat publié : ' || trim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,''));
    body := 'Découvrez sa fiche dans CAP 2027.';
    perform public._bump_admin_change_counter();
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','x-push-token', push_secret),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'candidate_published')
    );
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_election_results_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  push_secret constant text := public.get_push_broadcast_secret();
  winner_name text;
  title text;
  body constant text := 'Découvrez les scores dans CAP 2027.';
begin
  if NEW.key <> 'election.results' then
    return NEW;
  end if;

  if coalesce((OLD.value->>'round1_published')::boolean, false) = false
     and (NEW.value->>'round1_published')::boolean = true then
    title := 'Résultats du 1er tour disponibles';
    perform public._bump_admin_change_counter();
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','x-push-token', push_secret),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'election_results_published')
    );
  end if;

  if coalesce((OLD.value->>'round2_published')::boolean, false) = false
     and (NEW.value->>'round2_published')::boolean = true then
    select trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,''))
      into winner_name
      from public.election_results r
      join public.candidates c on c.id = r.candidate_id
      where r.round = 2 and r.is_winner = true
      limit 1;

    title := case when winner_name is not null and length(winner_name) > 0
                  then winner_name || ' élu·e président·e'
                  else 'Résultats du 2nd tour disponibles'
             end;
    perform public._bump_admin_change_counter();
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','x-push-token', push_secret),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'election_results_published')
    );
  end if;

  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_match_proposition_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  push_secret constant text := public.get_push_broadcast_secret();
  title text;
  body constant text := 'De nouvelles questions sont disponibles dans CAP 2027.';
begin
  if TG_OP = 'INSERT' and NEW.is_active = true then
    null;
  elsif TG_OP = 'UPDATE' and coalesce(OLD.is_active, false) = false and NEW.is_active = true then
    null;
  else
    return NEW;
  end if;

  title := 'Nouvelle proposition de boussole';
  perform public._bump_admin_change_counter();
  perform net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type','application/json','x-push-token', push_secret),
    body := jsonb_build_object('title', title, 'body', body, 'type', 'match_proposition_change')
  );
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_candidate_program()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  push_secret constant text := public.get_push_broadcast_secret();
  cand record;
  theme_name text;
  title text;
  body text;
begin
  select first_name, last_name, is_published
    into cand
    from public.candidates where id = NEW.candidate_id;
  if cand is null or coalesce(cand.is_published, false) = false then
    return NEW;
  end if;

  select name into theme_name from public.themes where id = NEW.theme_id;

  title := 'Nouveau programme : ' || coalesce(theme_name, 'thématique')
        || ' — ' || trim(coalesce(cand.first_name,'') || ' ' || coalesce(cand.last_name,''));
  body := 'Ouvrez CAP 2027 pour consulter le programme détaillé.';

  perform public._bump_admin_change_counter();
  perform net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type','application/json','x-push-token', push_secret),
    body := jsonb_build_object('title', title, 'body', body, 'type', 'new_programme')
  );
  return NEW;
end;
$function$;
