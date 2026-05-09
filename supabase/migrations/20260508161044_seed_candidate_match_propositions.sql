-- Seed: 5 propositions per theme per candidate (4 themes × 3 candidates = 60 rows)
-- Each proposition is phrased as the candidate's own stated position.
insert into public.candidate_match_propositions (candidate_id, theme_id, text, order_index)
select c.id, t.id, p.text, p.order_index
from (values
  -- Jean Martin (Renaissance) — pragmatique, droite-centre
  ('jean-martin', 'ecologie', 1, 'Construire 8 nouveaux réacteurs nucléaires EPR2 d''ici 2040.'),
  ('jean-martin', 'ecologie', 2, 'Maintenir la liberté de choix sur les moteurs thermiques en levant l''interdiction de 2035.'),
  ('jean-martin', 'ecologie', 3, 'Rénover thermiquement 700 000 logements par an dès 2028.'),
  ('jean-martin', 'ecologie', 4, 'Recentrer le bonus écologique sur les véhicules produits en Europe.'),
  ('jean-martin', 'ecologie', 5, 'Investir 30 Md€ dans un fonds souverain dédié au nucléaire.'),

  ('jean-martin', 'economie', 1, 'Baisser l''impôt sur les sociétés à 20 % pour les PME.'),
  ('jean-martin', 'economie', 2, 'Supprimer définitivement la CVAE résiduelle.'),
  ('jean-martin', 'economie', 3, 'Réformer l''assurance chômage avec une durée modulée selon la conjoncture.'),
  ('jean-martin', 'economie', 4, 'Atteindre 1 million d''apprentis par an.'),
  ('jean-martin', 'economie', 5, 'Réindustrialiser la France via 100 sites stratégiques d''ici 2032.'),

  ('jean-martin', 'social', 1, 'Maintenir l''âge légal de la retraite à 64 ans.'),
  ('jean-martin', 'social', 2, 'Porter la pension minimum à 1 200 € pour une carrière complète.'),
  ('jean-martin', 'social', 3, 'Universaliser les allocations familiales dès le 1er enfant.'),
  ('jean-martin', 'social', 4, 'Doubler le congé paternité à 56 jours.'),
  ('jean-martin', 'social', 5, 'Créer 200 000 places de crèche supplémentaires d''ici 2030.'),

  ('jean-martin', 'securite', 1, 'Recruter 10 000 policiers et gendarmes supplémentaires.'),
  ('jean-martin', 'securite', 2, 'Construire 15 000 nouvelles places de prison.'),
  ('jean-martin', 'securite', 3, 'Étendre la vidéoprotection aux centres-villes de plus de 20 000 habitants.'),
  ('jean-martin', 'securite', 4, 'Créer une cour d''assises spéciale pour la grande criminalité.'),
  ('jean-martin', 'securite', 5, 'Renforcer les peines plancher pour les multirécidivistes.'),

  -- Claire Dubois (Verts Unis) — écolo-progressiste
  ('claire-dubois', 'ecologie', 1, 'Atteindre 100 % d''énergies renouvelables en 2050.'),
  ('claire-dubois', 'ecologie', 2, 'Sortir du nucléaire selon un calendrier de 25 ans.'),
  ('claire-dubois', 'ecologie', 3, 'Interdire la vente de véhicules thermiques neufs dès 2030.'),
  ('claire-dubois', 'ecologie', 4, 'Créer 30 nouveaux parcs nationaux.'),
  ('claire-dubois', 'ecologie', 5, 'Interdire les néonicotinoïdes sans dérogation possible.'),

  ('claire-dubois', 'economie', 1, 'Instaurer un ISF climatique à partir de 5 M€ de patrimoine.'),
  ('claire-dubois', 'economie', 2, 'Renforcer la taxe carbone aux frontières européennes.'),
  ('claire-dubois', 'economie', 3, 'Conditionner toutes les aides aux entreprises à des critères écologiques.'),
  ('claire-dubois', 'economie', 4, 'Généraliser la semaine de 32 heures sur 4 jours.'),
  ('claire-dubois', 'economie', 5, 'Augmenter immédiatement le SMIC à 1 600 € net.'),

  ('claire-dubois', 'social', 1, 'Créer un revenu de transition écologique à 800 €/mois.'),
  ('claire-dubois', 'social', 2, 'Encadrer les loyers au niveau national.'),
  ('claire-dubois', 'social', 3, 'Construire 200 000 logements sociaux par an.'),
  ('claire-dubois', 'social', 4, 'Garantir l''accès universel aux transports en commun pour les jeunes.'),
  ('claire-dubois', 'social', 5, 'Rendre contraignant l''index Égalité femmes-hommes.'),

  ('claire-dubois', 'europe', 1, 'Sortir des traités de libre-échange comme le CETA et le Mercosur.'),
  ('claire-dubois', 'europe', 2, 'Lancer un grand emprunt vert européen de 200 Md€.'),
  ('claire-dubois', 'europe', 3, 'Imposer un salaire minimum européen indexé sur les pays les plus avancés.'),
  ('claire-dubois', 'europe', 4, 'Créer un Parquet écologique européen.'),
  ('claire-dubois', 'europe', 5, 'Refuser tout nouvel élargissement sans réforme préalable des institutions.'),

  -- Antoine Lefèvre (Union Citoyenne) — centriste social
  ('antoine-lefevre', 'sante', 1, 'Ouvrir 500 maisons de santé pluridisciplinaires d''ici 2030.'),
  ('antoine-lefevre', 'sante', 2, 'Créer un statut de salarié optionnel pour les médecins en zone sous-dotée.'),
  ('antoine-lefevre', 'sante', 3, 'Embaucher 30 000 soignants supplémentaires à l''hôpital public.'),
  ('antoine-lefevre', 'sante', 4, 'Sortir progressivement de la T2A (tarification à l''activité).'),
  ('antoine-lefevre', 'sante', 5, 'Doter le plan national santé mentale de 2 Md€.'),

  ('antoine-lefevre', 'securite', 1, 'Doubler la présence policière dans les transports en commun.'),
  ('antoine-lefevre', 'securite', 2, 'Armer toutes les polices municipales sur décision du maire.'),
  ('antoine-lefevre', 'securite', 3, 'Créer une véritable police de proximité avec 10 000 agents dédiés.'),
  ('antoine-lefevre', 'securite', 4, 'Recruter 3 000 magistrats supplémentaires.'),
  ('antoine-lefevre', 'securite', 5, 'Rétablir une justice de proximité dans chaque chef-lieu de canton.'),

  ('antoine-lefevre', 'education', 1, 'Limiter à 18 élèves les classes en zones d''éducation prioritaire.'),
  ('antoine-lefevre', 'education', 2, 'Réformer Parcoursup en imposant la transparence des algorithmes locaux.'),
  ('antoine-lefevre', 'education', 3, 'Doubler le nombre de places en BTS.'),
  ('antoine-lefevre', 'education', 4, 'Revaloriser les bourses universitaires de 30 %.'),
  ('antoine-lefevre', 'education', 5, 'Renforcer les fondamentaux (lecture, écriture, calcul) au primaire.'),

  ('antoine-lefevre', 'social', 1, 'Renforcer le congé parental partagé entre les deux parents.'),
  ('antoine-lefevre', 'social', 2, 'Plafonner les frais bancaires sur les comptes des plus modestes.'),
  ('antoine-lefevre', 'social', 3, 'Indexer les pensions de retraite sur le coût réel de la vie.'),
  ('antoine-lefevre', 'social', 4, 'Créer un service public de la petite enfance.'),
  ('antoine-lefevre', 'social', 5, 'Garantir l''accès à un médecin traitant en moins de 7 jours.')
) as p(slug, theme_slug, order_index, text)
join public.candidates c on c.slug = p.slug
join public.themes t on t.slug = p.theme_slug;
