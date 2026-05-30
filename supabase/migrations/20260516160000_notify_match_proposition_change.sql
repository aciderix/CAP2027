-- Push notif + admin counter bump when a new active match proposition
-- is added to the boussole. Mirrors notify_new_candidate_program in
-- shape and behaviour.
--
-- Only INSERT triggers the path (silent on UPDATE so minor admin
-- corrections don't ping users on every edit). DELETE triggers the
-- path too because the badge count would shift — handled by checking
-- TG_OP and using OLD instead of NEW for delete.

create or replace function public.notify_match_proposition_change() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  title text;
  body constant text := 'De nouvelles questions sont disponibles dans CAP 2027.';
begin
  -- Only act on INSERT of an active proposition. UPDATE flipping
  -- is_active to true also counts (admin un-deactivating a row).
  -- DELETE doesn't notify but bumping the counter would help the
  -- client recount; skip for simplicity — staleTime + counter from
  -- other notify_* fires will catch the deletion later.
  if TG_OP = 'INSERT' and NEW.is_active = true then
    -- ok
  elsif TG_OP = 'UPDATE' and coalesce(OLD.is_active, false) = false and NEW.is_active = true then
    -- ok
  else
    return NEW;
  end if;

  title := 'Nouvelle proposition de boussole';
  perform public._bump_admin_change_counter();
  perform net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('title', title, 'body', body, 'type', 'match_proposition_change')
  );
  return NEW;
end;
$$;

drop trigger if exists trg_match_proposition_notify on public.candidate_match_propositions;
create trigger trg_match_proposition_notify
  after insert or update on public.candidate_match_propositions
  for each row execute function public.notify_match_proposition_change();
