-- candidate_programs was the only candidate_* table missing an
-- admin write policy. Inserting / updating from the admin console
-- failed with "new row violates row-level security policy".
-- Add the same pattern as every other candidate_* table.
create policy "candidate_programs_admin_write" on public.candidate_programs
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
