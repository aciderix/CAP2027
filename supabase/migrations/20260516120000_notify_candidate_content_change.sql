-- Push notifications when a published candidate's profile content changes.
--
-- Scope:
--   - candidates.short_bio (UPDATE only — publication transitions are
--     already covered by notify_candidate_published, so we skip those)
--   - candidate_bio_sections (INSERT + content UPDATE)
--   - candidate_proposals    (INSERT + content UPDATE)
--   - candidate_affairs      (INSERT + content UPDATE)
--
-- Common rules:
--   - Skip if the parent candidate is not published (drafts stay silent)
--   - Skip if only order_index / updated_at changed (admin reorder)
--   - Broadcast to every device (no candidate_id filter) — same
--     reasoning as notify_candidate_published: profile updates are
--     headline content
--   - Tag every payload with data.type = 'candidate_updated' so the
--     client invalidates the right TanStack Query caches on reception
--
-- Additive only: existing triggers/functions are untouched.

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
  -- Resolve candidate_id (column name differs between candidates and children)
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
    -- Skip the publication transition: notify_candidate_published already
    -- emits "Nouveau candidat publié" for that flip; emitting a second
    -- "bio courte mise à jour" on the same write would spam users.
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

  perform net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('title', title, 'body', body, 'type', notif_type)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_candidates_content_notify on public.candidates;
create trigger trg_candidates_content_notify
  after update on public.candidates
  for each row execute function public.notify_candidate_content_change();

drop trigger if exists trg_candidate_bio_sections_notify on public.candidate_bio_sections;
create trigger trg_candidate_bio_sections_notify
  after insert or update on public.candidate_bio_sections
  for each row execute function public.notify_candidate_content_change();

drop trigger if exists trg_candidate_proposals_notify on public.candidate_proposals;
create trigger trg_candidate_proposals_notify
  after insert or update on public.candidate_proposals
  for each row execute function public.notify_candidate_content_change();

drop trigger if exists trg_candidate_affairs_notify on public.candidate_affairs;
create trigger trg_candidate_affairs_notify
  after insert or update on public.candidate_affairs
  for each row execute function public.notify_candidate_content_change();
