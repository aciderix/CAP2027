-- Storage buckets for candidate photos and party logos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('candidate-photos', 'candidate-photos', true, 5242880,
   array['image/png','image/jpeg','image/webp']),
  ('party-logos', 'party-logos', true, 2097152,
   array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- Public read policies (writes still require service_role)
create policy "candidate_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'candidate-photos');

create policy "party_logos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'party-logos');
