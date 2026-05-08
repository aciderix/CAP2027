-- Public buckets serve files directly via public URL — no SELECT policy needed.
-- Removing broad SELECT policies prevents listing of bucket contents.
drop policy if exists "candidate_photos_public_read" on storage.objects;
drop policy if exists "party_logos_public_read" on storage.objects;
