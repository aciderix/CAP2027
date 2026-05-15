-- Auto-push when a programme is added to a candidate. Companion to
-- the existing notify_admin_action triggers on app_config /
-- candidates. Body composed from the theme name and candidate full
-- name. Broadcast to every device — programmes are headline content
-- that's worth knowing about regardless of which candidates the user
-- specifically follows.

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
  -- Don't push for drafts: if the candidate isn't published, the
  -- programme link wouldn't be reachable from the app feed anyway.
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
    body := jsonb_build_object('title', title, 'body', body)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_candidate_programs_notify on public.candidate_programs;
create trigger trg_candidate_programs_notify
  after insert on public.candidate_programs
  for each row execute function public.notify_new_candidate_program();
