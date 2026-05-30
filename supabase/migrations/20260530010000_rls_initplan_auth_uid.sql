-- Issue #19 — auth.uid() réévalué par ligne dans les policies admin.
-- On NE change PAS la logique : is_admin(auth.uid()) devient
-- is_admin((select auth.uid())). Le sous-select force Postgres à évaluer
-- auth.uid() UNE fois (InitPlan) au lieu d'une fois par ligne.
--
-- ALTER POLICY sur les 15 policies *_admin_write existantes (USING + CHECK).
-- Aucune création/suppression : on modifie l'expression en place, à
-- l'identique hormis le (select ...).

alter policy app_config_admin_write on public.app_config
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy candidate_affairs_admin_write on public.candidate_affairs
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy candidate_aliases_admin_write on public.candidate_aliases
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy candidate_bio_sections_admin_write on public.candidate_bio_sections
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy candidate_match_propositions_admin_write on public.candidate_match_propositions
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy candidate_programs_admin_write on public.candidate_programs
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy candidate_proposals_admin_write on public.candidate_proposals
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy candidates_admin_write on public.candidates
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy election_results_admin_write on public.election_results
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy news_sources_admin_write on public.news_sources
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy parties_admin_write on public.parties
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy party_aliases_admin_write on public.party_aliases
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy theme_keywords_admin_write on public.theme_keywords
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

alter policy themes_admin_write on public.themes
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

-- Note : la policy admins_self_read (admins) utilise aussi auth.uid()
-- directement (user_id = auth.uid()). On l'encapsule de même.
alter policy admins_self_read on public.admins
  using (user_id = (select auth.uid()));
