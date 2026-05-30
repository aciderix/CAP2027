-- Issues #6 / #10 — policies push trop permissives (USING(true)).
--
-- Constat (vérifié) : le front n'a JAMAIS besoin de SELECT ni de DELETE
-- direct sur ces tables. Il fait :
--   - push_tokens               : upsert (INSERT ... ON CONFLICT DO UPDATE)
--   - push_token_follows        : INSERT + RPC unfollow_candidate
--   - push_token_orientations   : INSERT + RPC unfollow_orientation / clear_orientations
-- Les RPC sont SECURITY DEFINER → elles suppriment en contournant la RLS.
--
-- On retire donc à anon/authenticated :
--   - la lecture (SELECT) → coupe l'énumération des tokens (le pire de #6)
--   - le DELETE direct     → seul le unfollow par RPC reste possible
-- On conserve INSERT (activer notif / suivre) et, pour push_tokens,
-- UPDATE (l'upsert met à jour last_seen_at à chaque ré-ouverture).
--
-- On NE touche PAS aux RPC ni aux données : juste les policies.

-- ── push_tokens ───────────────────────────────────────────────────────────
-- Remplace la policy FOR ALL (USING true / CHECK true) par INSERT + UPDATE.
drop policy if exists push_tokens_anon_all on public.push_tokens;

create policy push_tokens_anon_insert on public.push_tokens
  as permissive for insert to anon, authenticated
  with check (true);

create policy push_tokens_anon_update on public.push_tokens
  as permissive for update to anon, authenticated
  using (true) with check (true);

-- ── push_token_follows ─────────────────────────────────────────────────────
-- Supprime le DELETE direct (le unfollow passe par la RPC SECURITY DEFINER).
-- L'INSERT reste (suivre un candidat).
drop policy if exists push_token_follows_anon_delete on public.push_token_follows;

-- ── push_token_orientations ────────────────────────────────────────────────
-- Idem : supprime le DELETE direct, garde l'INSERT (suivre un bord).
drop policy if exists push_token_orientations_anon_delete on public.push_token_orientations;
