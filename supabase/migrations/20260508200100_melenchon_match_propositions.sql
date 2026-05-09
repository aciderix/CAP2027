insert into public.candidate_match_propositions (candidate_id, theme_id, text, order_index)
select c.id, t.id, p.text, p.order_index
from (values
  -- Écologie (bifurcation écologique LFI)
  ('ecologie', 1, 'Atteindre 100 % d''énergies renouvelables en 2050 et sortir progressivement du nucléaire.'),
  ('ecologie', 2, 'Interdire totalement les pesticides néonicotinoïdes et le glyphosate.'),
  ('ecologie', 3, 'Lancer un plan massif de rénovation thermique de 700 000 logements par an.'),
  ('ecologie', 4, 'Instaurer la gratuité des transports publics urbains pour les jeunes.'),
  ('ecologie', 5, 'Inscrire dans la Constitution une « règle verte » contraignante.'),

  -- Économie / fiscalité
  ('economie', 1, 'Porter le SMIC à 1 600 € net dès la première année de mandat.'),
  ('economie', 2, 'Rétablir la retraite à 60 ans avec 40 annuités de cotisation.'),
  ('economie', 3, 'Instaurer un taux marginal d''imposition à 90 % au-dessus de 400 000 € de revenu annuel.'),
  ('economie', 4, 'Renationaliser les autoroutes, EDF et la production d''électricité.'),
  ('economie', 5, 'Désobéir aux traités budgétaires européens jugés contraires à la souveraineté populaire.'),

  -- Social
  ('social', 1, 'Encadrer strictement les loyers et plafonner les prix de l''énergie et des produits de première nécessité.'),
  ('social', 2, 'Construire 200 000 logements sociaux par an pendant tout le quinquennat.'),
  ('social', 3, 'Créer une garantie d''autonomie pour les jeunes en formation à hauteur de 1 063 €/mois.'),
  ('social', 4, 'Instaurer une 6ᵉ semaine de congés payés.'),
  ('social', 5, 'Supprimer Parcoursup et toute sélection à l''entrée à l''université.'),

  -- Europe
  ('europe', 1, 'Désobéir aux traités européens contraires au programme présidentiel.'),
  ('europe', 2, 'Sortir de l''OTAN et adopter une diplomatie altermondialiste.'),
  ('europe', 3, 'Refuser le CETA, le Mercosur et tout futur traité de libre-échange.'),
  ('europe', 4, 'Renégocier les règles budgétaires européennes pour libérer l''investissement écologique.'),
  ('europe', 5, 'Mettre en place un protectionnisme solidaire fondé sur des critères écologiques et sociaux.')
) as p(theme_slug, order_index, text)
join public.candidates c on c.slug = 'jean-luc-melenchon'
join public.themes t on t.slug = p.theme_slug;
