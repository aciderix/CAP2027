-- Échelle d'orientation symétrique : extreme-gauche, gauche, centre-gauche,
-- centre, centre-droit, droite, extreme-droite (+ transverse, factcheck).
-- Critère : la façon dont l'article Wikipédia du média (ou du parti, pour
-- les comptes des candidats) le caractérise ; « extrême » seulement quand
-- Wikipédia l'indique sans nuance. Relevé du 20 octobre 2026.
--
-- À APPLIQUER APRÈS la publication de la version de l'appli qui connaît ces
-- catégories : les versions antérieures afficheraient la valeur brute dans
-- les filtres et masqueraient ces médias de la page Sources.

-- Médias
update public.news_sources set orientation = 'extreme-droite'
where slug in ('valeurs-actuelles', 'bvoltaire', 'omerta', 'lejdd', 'causeur');

update public.news_sources set orientation = 'centre-gauche'
where slug in ('lemonde-politique', 'yt-brut');

update public.news_sources set orientation = 'centre'
where slug in ('yt-hugodecrypte', 'theconversation');

update public.news_sources set orientation = 'transverse'
where slug = 'frontpopulaire';

-- Comptes des candidats : positionnement du parti sur Wikipédia
-- (RN et Reconquête : « Extrême droite » ; Lutte ouvrière : « Extrême gauche »).
update public.news_sources s set orientation = 'extreme-droite'
from public.candidates c
where s.candidate_id = c.id and c.slug in ('marine-le-pen', 'eric-zemmour');

update public.news_sources s set orientation = 'extreme-gauche'
from public.candidates c
where s.candidate_id = c.id and c.slug = 'nathalie-arthaud';

-- Notifications : un appareil qui suivait l'ancienne catégorie suit aussi la
-- nouvelle, pour continuer à recevoir les mêmes médias. L'appli fait la même
-- chose sur l'appareil (lib/orientationFollows.ts) ; ceci couvre les appareils
-- qui n'ont pas encore la nouvelle version.
insert into public.push_token_orientations (token, orientation)
select token,
       case orientation
         when 'gauche' then 'extreme-gauche'
         when 'centre' then 'centre-gauche'
         when 'droite' then 'extreme-droite'
       end
from public.push_token_orientations
where orientation in ('gauche', 'centre', 'droite')
on conflict do nothing;
