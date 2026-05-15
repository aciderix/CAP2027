-- Array variant of tokens_for_press_orientation: returns tokens that
-- should receive a single consolidated press notif whose article set
-- spans multiple source orientations. Same opt-in lenient rule:
-- tokens with no rows in push_token_orientations always match;
-- tokens with rows match if they have at least one of the input
-- orientations.

create or replace function public.tokens_for_press_orientations(orients text[])
returns table(token text, platform text)
language sql
security definer
set search_path = public
as $$
  select t.token, t.platform
  from public.push_tokens t
  where not exists (
    select 1 from public.push_token_orientations o where o.token = t.token
  )
  or exists (
    select 1 from public.push_token_orientations o
    where o.token = t.token and o.orientation = any(orients)
  )
$$;

grant execute on function public.tokens_for_press_orientations(text[]) to service_role;
