-- Server-side change counter so the client can detect "something
-- changed since my last visit" on cold start without paying for a full
-- refetch of every admin-driven query on every app open.
--
-- Flow:
--   1. Each notify_* trigger that fires a push also bumps
--      app_config['admin.last_change'].counter via _bump_admin_change_counter()
--   2. useAppConfig in the client already reads app_config; the new
--      useAdminChangeSync hook compares the server counter to the
--      localStorage-stored one and invalidates the admin-driven caches
--      ONCE if they differ.
--
-- Anti-recursion: bumping app_config['admin.last_change'] re-fires
-- notify_app_config_change, but its switch only acts on the
-- election.round1/2 and parrainages.source keys — `admin.last_change`
-- falls through silently. No loop.

insert into public.app_config (key, value)
values ('admin.last_change', jsonb_build_object('counter', 0))
on conflict (key) do nothing;

create or replace function public._bump_admin_change_counter() returns void
  language plpgsql security definer set search_path = ''
as $$
begin
  update public.app_config
  set value = jsonb_build_object(
    'counter', coalesce((value->>'counter')::int, 0) + 1,
    'at', to_jsonb(now())
  ),
  updated_at = now()
  where key = 'admin.last_change';
end;
$$;

-- Recreate each notify_* function adding the counter bump right before
-- the net.http_post call. Bumping only when a push is actually sent
-- (not on every silent draft edit) keeps the counter aligned with the
-- "user just got a notif" event.

create or replace function public.notify_candidate_published() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
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
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'candidate_published')
    );
  end if;
  return NEW;
end;
$$;

create or replace function public.notify_app_config_change() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
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
        headers := jsonb_build_object('Content-Type','application/json'),
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
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('title', title, 'body', body, 'type', 'parrainages_update')
      );
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.notify_new_candidate_program() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
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
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('title', title, 'body', body, 'type', 'new_programme')
  );
  return NEW;
end;
$$;

create or replace function public.notify_candidate_content_change() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
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
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('title', title, 'body', body, 'type', notif_type)
  );
  return NEW;
end;
$$;

create or replace function public.notify_election_results_published() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
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
      headers := jsonb_build_object('Content-Type','application/json'),
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
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'election_results_published')
    );
  end if;

  return NEW;
end;
$$;
