-- Tag every server-triggered push with a data.type so the client can
-- invalidate the right TanStack Query keys on reception. See push.ts
-- pushNotificationReceived listener for the mapping.

create or replace function public.notify_admin_action() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  title text;
  body text;
  round_label text;
  notif_type text;
begin
  if TG_TABLE_NAME = 'app_config' and NEW.key in ('election.round1', 'election.round2') then
    if coalesce((OLD.value->>'is_official')::boolean, false) = false
       and (NEW.value->>'is_official')::boolean = true then
      round_label := case NEW.key when 'election.round1' then '1er' else '2nd' end;
      title := 'Date du scrutin officialisée';
      body := 'La date du ' || round_label || ' tour de l''élection présidentielle 2027 est désormais confirmée. Ouvrez CAP 2027 pour la consulter.';
      notif_type := 'date_official';
      perform net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('title', title, 'body', body, 'type', notif_type)
      );
    end if;
  end if;

  if TG_TABLE_NAME = 'app_config' and NEW.key = 'parrainages.source' then
    if coalesce((OLD.value->>'is_available')::boolean, false) = false
       and (NEW.value->>'is_available')::boolean = true then
      title := 'Parrainages disponibles';
      body := 'Le compteur officiel des 500 signatures d''élus par candidat est désormais accessible dans l''app.';
      notif_type := 'parrainages_update';
      perform net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('title', title, 'body', body, 'type', notif_type)
      );
    end if;
  end if;

  if TG_TABLE_NAME = 'candidates' then
    if (TG_OP = 'INSERT' and NEW.is_published = true)
       or (TG_OP = 'UPDATE' and coalesce(OLD.is_published, false) = false and NEW.is_published = true) then
      title := 'Nouveau candidat publié : ' || trim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,''));
      body := 'Découvrez sa fiche dans CAP 2027.';
      notif_type := 'candidate_published';
      perform net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('title', title, 'body', body, 'type', notif_type)
      );
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function public.notify_new_candidate_program()
returns trigger
language plpgsql
security definer
set search_path = ''
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

  perform net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('title', title, 'body', body, 'type', 'new_programme')
  );
  return NEW;
end;
$$;
