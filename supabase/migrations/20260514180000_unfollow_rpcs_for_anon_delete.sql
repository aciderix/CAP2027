-- Anon-callable DELETE helpers for push_token_follows /
-- push_token_orientations. Without a SELECT policy on these tables,
-- a plain DELETE issued by anon matches 0 rows (RLS hides rows from
-- the implicit row scan), so toggle-off didn't actually remove
-- anything. We expose security-definer RPCs that bypass RLS for the
-- exact (token, candidate_id|orientation) tuple, keeping the
-- table-level SELECT closed.

create or replace function public.unfollow_candidate(p_token text, p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_token_follows
  where token = p_token and candidate_id = p_candidate_id;
end;
$$;

create or replace function public.unfollow_orientation(p_token text, p_orientation text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_token_orientations
  where token = p_token and orientation = p_orientation;
end;
$$;

create or replace function public.clear_orientations(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_token_orientations where token = p_token;
end;
$$;

grant execute on function public.unfollow_candidate(text, uuid) to anon, authenticated;
grant execute on function public.unfollow_orientation(text, text) to anon, authenticated;
grant execute on function public.clear_orientations(text) to anon, authenticated;
