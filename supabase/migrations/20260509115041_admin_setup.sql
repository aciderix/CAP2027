-- Public-read storage bucket for candidate photos / party logos / app
-- assets uploaded via the admin dashboard.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- Anyone can read (public files), only authenticated admins can write.
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

-- Admin allowlist. Users in this table (linked to auth.users) can write
-- to the media bucket and bypass RLS on editor-protected tables.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- Admin self-read so the dashboard can verify whether the signed-in
-- user is allowed to enter the editor.
drop policy if exists "admins_self_read" on public.admins;
create policy "admins_self_read" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- Helper: is_admin(uid)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (select 1 from public.admins a where a.user_id = uid);
$$;
revoke execute on function public.is_admin(uuid) from public;
grant  execute on function public.is_admin(uuid) to anon, authenticated;

-- Storage write/delete rules: only admins
drop policy if exists "media_admin_insert" on storage.objects;
create policy "media_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin(auth.uid()));

drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin(auth.uid()))
  with check (bucket_id = 'media' and public.is_admin(auth.uid()));

drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_admin(auth.uid()));

-- Editor RLS on public.* tables (admins can write; everyone keeps reading).
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'candidates', 'parties', 'themes',
    'candidate_aliases', 'party_aliases', 'theme_keywords',
    'news_sources',
    'candidate_bio_sections', 'candidate_proposals', 'candidate_affairs',
    'candidate_match_propositions',
    'app_config'
  ]) loop
    execute format('drop policy if exists "%s_admin_write" on public.%I', t, t);
    execute format($f$create policy "%s_admin_write" on public.%I
      for all to authenticated
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))$f$, t, t);
  end loop;
end$$;
