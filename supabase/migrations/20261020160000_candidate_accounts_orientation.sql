-- Comptes des candidats : positionnement du parti sur Wikipédia (infobox),
-- relevé le 20 octobre 2026. Quand Wikipédia donne une fourchette, on retient
-- son milieu, ou sa borne la plus modérée si elle n'a que deux valeurs.
--   Place publique (Glucksmann) : « Centre gauche »
--   Génération écologie (Batho) : « Centre gauche »
--   Parti socialiste (Bouamrane) : « Centre gauche à gauche »
--   Horizons (Philippe) : « Centre droit »
-- Inchangés : Renaissance « Centre gauche à droite » -> centre ; Les
-- Écologistes « Centre gauche à gauche radicale » -> gauche ; LR « Droite à
-- droite radicale » -> droite. Déjà appliqué en prod.
update public.news_sources s set orientation = 'centre-gauche'
from public.candidates c
where s.candidate_id = c.id and c.slug in ('raphael-glucksmann', 'delphine-batho', 'karim-bouamrane');

update public.news_sources s set orientation = 'centre-droit'
from public.candidates c
where s.candidate_id = c.id and c.slug = 'edouard-philippe';
