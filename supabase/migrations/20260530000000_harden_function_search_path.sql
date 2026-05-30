-- Issue #20 — search_path mutable sur 3 fonctions.
-- On NE réécrit PAS le corps : simple ALTER FUNCTION ... SET search_path.
-- La base est la source de vérité ; on se contente de figer le search_path.
--
-- Vérifié au préalable (snapshot prod) :
--   - is_admin              → corps qualifie public.admins
--   - purge_old_articles    → corps qualifie public.news_articles / public.article_candidates
--   - decode_html_entities  → aucune table, uniquement des fonctions natives
--     (replace, regexp_matches, regexp_replace, chr, lpad…) → besoin de pg_catalog.
--
-- search_path='' impose la qualification complète des noms ; comme les corps
-- sont déjà qualifiés, aucun changement de comportement.

alter function public.is_admin(uuid)            set search_path = '';
alter function public.purge_old_articles()      set search_path = '';

-- decode_html_entities n'accède à aucune table mais utilise des fonctions
-- de pg_catalog : on l'inclut explicitement pour qu'elles restent résolues.
alter function public.decode_html_entities(text) set search_path = 'pg_catalog';
