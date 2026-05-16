-- Split notify_admin_action() into two single-responsibility functions:
--   - notify_candidate_published() — handles candidates table triggers
--   - notify_app_config_change() — handles app_config election/parrainages flips
--
-- Repo-DB parity: this migration was applied in production on
-- 2026-05-10 but was missing from the repo until now (recovered from
-- the live database for traceability — see the data-type fix in the
-- next migration which actually re-adds the type field that was lost
-- in this split).

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
      body := jsonb_build_object('title', title, 'body', body)
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
        body := jsonb_build_object('title', title, 'body', body)
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
        body := jsonb_build_object('title', title, 'body', body)
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_candidates_notify on public.candidates;
create trigger trg_candidates_notify
  after insert or update on public.candidates
  for each row execute function public.notify_candidate_published();

drop trigger if exists trg_app_config_notify on public.app_config;
create trigger trg_app_config_notify
  after update on public.app_config
  for each row execute function public.notify_app_config_change();
