-- Parties (fictives)
insert into public.parties (name, abbreviation, color, order_index) values
  ('Parti Renaissance',     'REN', '#FFB100', 1),
  ('Parti des Verts Unis',  'PVU', '#16A34A', 2),
  ('Union Citoyenne',       'UC',  '#2563EB', 3);

-- Themes
insert into public.themes (slug, name, icon, color, order_index) values
  ('ecologie',     'Écologie',     'Leaf',          '#16A34A', 1),
  ('economie',     'Économie',     'TrendingUp',    '#F59E0B', 2),
  ('social',       'Social',       'Users',         '#EC4899', 3),
  ('sante',        'Santé',        'HeartPulse',    '#EF4444', 4),
  ('securite',     'Sécurité',     'Shield',        '#1E40AF', 5),
  ('education',    'Éducation',    'GraduationCap', '#7C3AED', 6),
  ('europe',       'Europe',       'Globe',         '#0EA5E9', 7),
  ('justice',      'Justice',      'Scale',         '#0F766E', 8),
  ('immigration',  'Immigration',  'Plane',         '#9333EA', 9),
  ('institutions', 'Institutions', 'Landmark',      '#475569', 10);

-- Match propositions (libellés neutres canoniques)
insert into public.match_propositions (theme_id, text, order_index)
select t.id, p.text, p.order_index
from (values
  ('ecologie',  'Interdire la vente de voitures thermiques neuves dès 2030.', 1),
  ('ecologie',  'Réintroduire des centrales nucléaires nouvelle génération.', 2),
  ('economie',  'Augmenter le SMIC à 1 600 € net.', 1),
  ('economie',  'Supprimer l''ISF pour relancer l''investissement.', 2),
  ('social',    'Rétablir la retraite à 60 ans pour les carrières longues.', 1),
  ('sante',     'Créer 100 000 places en EHPAD publics.', 1),
  ('securite',  'Doubler la présence policière dans les transports.', 1),
  ('education', 'Supprimer Parcoursup au profit d''un accès libre à l''université.', 1),
  ('europe',    'Sortir des traités européens sur le libre-échange.', 1),
  ('justice',   'Inscrire l''indépendance du parquet dans la Constitution.', 1)
) as p(theme_slug, text, order_index)
join public.themes t on t.slug = p.theme_slug;

-- Candidats fictifs
insert into public.candidates
  (slug, first_name, last_name, gender, party_id, status, declared_at,
   sponsorships_count, short_bio, is_published, order_index)
values
  ('jean-martin',     'Jean',    'Martin',  'M',
   (select id from public.parties where abbreviation = 'REN'),
   'declared', '2026-01-15', 142,
   'Ancien ministre, candidat déclaré du Parti Renaissance.', true, 1),
  ('claire-dubois',   'Claire',  'Dubois',  'F',
   (select id from public.parties where abbreviation = 'PVU'),
   'declared', '2026-02-03', 89,
   'Députée européenne, figure montante des Verts Unis.', true, 2),
  ('antoine-lefevre', 'Antoine', 'Lefèvre', 'M',
   (select id from public.parties where abbreviation = 'UC'),
   'pressenti', null, 0,
   'Maire de grande ville, pressenti pour porter les couleurs de l''Union Citoyenne.', true, 3);

-- Bio sections
insert into public.candidate_bio_sections (candidate_id, title, content, order_index)
select c.id, s.title, s.content, s.order_index
from (values
  ('jean-martin',     'Jeunesse et formation', 'Né en 1968 à Lyon, Jean Martin suit ses études à Sciences Po puis à l''ENA, dont il sort en 1994.', 1),
  ('jean-martin',     'Carrière politique',    'Conseiller à Bercy, puis directeur de cabinet ministériel, il est élu député en 2007.', 2),
  ('jean-martin',     'Vie privée',            'Marié, deux enfants. Passionné d''histoire et de cyclisme.', 3),
  ('claire-dubois',   'Origines',              'Née à Nantes en 1979, fille d''ingénieurs agronomes.', 1),
  ('claire-dubois',   'Engagement écologique', 'Co-fondatrice d''une ONG climatique en 2008, élue au Parlement européen en 2019.', 2),
  ('antoine-lefevre', 'Parcours',              'Médecin généraliste reconverti en politique locale au début des années 2010.', 1)
) as s(slug, title, content, order_index)
join public.candidates c on c.slug = s.slug;

-- Proposals
insert into public.candidate_proposals (candidate_id, theme_id, title, content, order_index)
select c.id, t.id, p.title, p.content, p.order_index
from (values
  ('jean-martin',     'ecologie', 'Plan nucléaire 2030',         'Construire 8 nouveaux réacteurs EPR2 d''ici 2040.', 1),
  ('jean-martin',     'economie', 'Allègement fiscal PME',       'Baisse de 5 points de l''IS pour les PME.', 1),
  ('claire-dubois',   'ecologie', '100 % renouvelable en 2050',  'Plan d''investissement de 200 Md€ sur 20 ans.', 1),
  ('claire-dubois',   'social',   'Revenu de transition écologique', 'Créer un revenu de 800 €/mois pour les métiers de la transition.', 1),
  ('antoine-lefevre', 'sante',    'Médecine de proximité',       'Ouvrir 500 maisons de santé pluridisciplinaires.', 1)
) as p(slug, theme_slug, title, content, order_index)
join public.candidates c on c.slug = p.slug
join public.themes t     on t.slug = p.theme_slug;

-- Affairs
insert into public.candidate_affairs (candidate_id, title, description, status, date, source_urls, order_index)
select c.id, a.title, a.description, a.status::affair_status, a.date::date, a.sources, a.order_index
from (values
  ('jean-martin', 'Frais de mandat 2018',
   'Enquête préliminaire sur des frais de représentation contestés.',
   'classee', '2019-06-15', array['https://example.org/source-1']::text[], 1)
) as a(slug, title, description, status, date, sources, order_index)
join public.candidates c on c.slug = a.slug;

-- News
insert into public.candidate_news (candidate_id, title, summary, url, source_name, published_at, is_featured)
select c.id, n.title, n.summary, n.url, n.source_name, n.published_at::timestamptz, n.is_featured
from (values
  ('jean-martin',
   'Jean Martin officialise sa candidature',
   'Lors d''un meeting à Lyon, Jean Martin a officiellement annoncé sa candidature.',
   'https://example.org/article-1', 'Le Monde',
   '2026-01-15T19:00:00Z', true),
  ('claire-dubois',
   'Claire Dubois en hausse dans les sondages',
   'Selon un sondage IFOP, Claire Dubois progresse de 3 points.',
   'https://example.org/article-2', 'Libération',
   '2026-04-22T08:30:00Z', false)
) as n(slug, title, summary, url, source_name, published_at, is_featured)
join public.candidates c on c.slug = n.slug;

-- Candidate positions on match propositions
insert into public.candidate_positions (candidate_id, proposition_id, stance, weight)
select c.id, mp.id, p.stance::match_stance, p.weight
from (values
  ('jean-martin',     'ecologie', 'Réintroduire des centrales nucléaires nouvelle génération.',           'pour',   5),
  ('jean-martin',     'economie', 'Supprimer l''ISF pour relancer l''investissement.',                    'pour',   4),
  ('jean-martin',     'social',   'Rétablir la retraite à 60 ans pour les carrières longues.',           'contre', 4),
  ('claire-dubois',   'ecologie', 'Réintroduire des centrales nucléaires nouvelle génération.',           'contre', 5),
  ('claire-dubois',   'ecologie', 'Interdire la vente de voitures thermiques neuves dès 2030.',           'pour',   5),
  ('claire-dubois',   'social',   'Rétablir la retraite à 60 ans pour les carrières longues.',           'pour',   4),
  ('antoine-lefevre', 'sante',    'Créer 100 000 places en EHPAD publics.',                              'pour',   5),
  ('antoine-lefevre', 'securite', 'Doubler la présence policière dans les transports.',                  'pour',   3)
) as p(slug, theme_slug, prop_text, stance, weight)
join public.candidates c on c.slug = p.slug
join public.themes t     on t.slug = p.theme_slug
join public.match_propositions mp on mp.theme_id = t.id and mp.text = p.prop_text;
