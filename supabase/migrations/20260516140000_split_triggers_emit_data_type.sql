-- Restore the data.type field on the two split admin-action triggers.
--
-- History of the regression:
--   - 20260510214750 created notify_admin_action() (one function, three cases).
--   - 20260510220450 split it into notify_candidate_published() and
--     notify_app_config_change() and re-pointed the triggers — but
--     without carrying over the (then-not-yet-added) type field.
--   - 20260515061744 (commit 24b59d3 "tagged pushes auto-invalidate
--     cache") re-created notify_admin_action() with the type field
--     added — but that function had been orphaned by the split, so
--     the triggers kept calling the type-less split versions and the
--     client's push.ts switch fell to the no-op default case for
--     candidate_published, date_official and parrainages_update.
--
-- This migration patches both split functions to emit the type field
-- the client already knows how to handle, and drops the orphan
-- notify_admin_action() so the regression can't reoccur.

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

-- The orphaned function created by 20260515061744_push_triggers_data_type.
-- Removing it so a future developer doesn't try to re-wire it.
drop function if exists public.notify_admin_action();
