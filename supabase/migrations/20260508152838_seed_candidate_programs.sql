insert into public.candidate_programs (candidate_id, theme_id, intro, content, order_index)
select c.id, t.id, p.intro, p.content, p.order_index
from (values
  -- Jean Martin (Renaissance)
  ('jean-martin', 'ecologie', 1,
   'Une transition écologique pragmatique, fondée sur la souveraineté énergétique.',
$$## Énergie : le retour du nucléaire

La France doit retrouver son indépendance énergétique. Je propose la **construction de 8 réacteurs EPR2** d''ici 2040, accompagnée de la prolongation contrôlée du parc existant.

- Mise en chantier des deux premiers réacteurs dès 2027
- Plan de formation de 50 000 ingénieurs et techniciens du nucléaire
- Création d''un fonds souverain dédié à 30 Md€

## Mobilité

Sortie progressive du diesel d''ici 2035, mais **maintien de la liberté de choix** pour les Français.

- Bonus écologique recentré sur les véhicules produits en Europe
- Déploiement de 400 000 bornes de recharge sur le territoire
- Plan vélo doublé : 500 M€ par an

## Bâtiment

Rénovation thermique : objectif 700 000 logements rénovés par an dès 2028.$$,
   1),
  ('jean-martin', 'economie', 1,
   'Libérer l''économie, restaurer la confiance des entrepreneurs.',
$$## Fiscalité

- Baisse de l''**impôt sur les sociétés à 20 %** pour les PME
- Suppression de la CVAE résiduelle
- Stabilité fiscale garantie sur 5 ans

## Emploi

Objectif **plein emploi à 4,5 %** de chômage en 2030.

- Réforme de l''assurance chômage : durée modulée selon la conjoncture
- Apprentissage : 1 million d''apprentis par an
- Allègements ciblés sur les bas salaires

## Souveraineté industrielle

Réindustrialiser la France : 100 sites industriels stratégiques d''ici 2032.$$,
   2),
  ('jean-martin', 'social', 1,
   'Une protection sociale modernisée, juste et soutenable.',
$$## Retraites

Maintien de l''âge légal à 64 ans, mais avec une **prise en compte renforcée des carrières longues et de la pénibilité**.

- Pension minimum à 1 200 € pour une carrière complète
- Cumul emploi-retraite simplifié

## Famille

- Universalisation des allocations familiales dès le 1er enfant
- Doublement du congé paternité à 56 jours
- 200 000 places de crèche supplémentaires d''ici 2030$$,
   3),

  -- Claire Dubois (Verts Unis)
  ('claire-dubois', 'ecologie', 1,
   'Faire de la France la première puissance écologique d''Europe.',
$$## 100 % renouvelable en 2050

Plan d''investissement massif : **200 Md€ sur 20 ans**, financé par un emprunt vert européen.

- Multiplication par 4 de la capacité éolienne offshore d''ici 2035
- Doublement du solaire photovoltaïque chaque législature
- Sortie progressive et planifiée du nucléaire d''ici 2050

## Biodiversité

- Création de 30 nouveaux parcs nationaux
- Interdiction des néonicotinoïdes sans dérogation possible
- Plan « Mille rivières » : restauration écologique des cours d''eau

## Mobilité

- Gratuité des transports en commun pour les moins de 26 ans
- Interdiction des vols intérieurs lorsqu''une alternative train < 4 h existe
- ZFE étendues à toutes les agglomérations > 100 000 habitants$$,
   1),
  ('claire-dubois', 'social', 1,
   'Personne ne doit être laissé au bord du chemin de la transition.',
$$## Revenu de transition écologique

Création d''un **revenu de 800 €/mois** pour toute personne se reconvertissant vers un métier de la transition (rénovation, énergies, agriculture biologique).

- Financé par une contribution exceptionnelle des grandes fortunes
- Conditionné à un parcours de formation certifié

## Logement

- Encadrement national des loyers
- 200 000 logements sociaux construits par an
- Garantie universelle des loyers pour tous les locataires$$,
   2),
  ('claire-dubois', 'economie', 1,
   'Réorienter l''économie vers l''utile, le durable et le local.',
$$## Fiscalité écologique

- Taxe carbone aux frontières renforcée
- ISF climatique : 1 % de patrimoine au-delà de 5 M€
- Conditionnalité écologique des aides aux entreprises

## Travail

- Semaine de 32 heures sur 4 jours, expérimentée puis généralisée
- Augmentation immédiate du SMIC à 1 600 € net
- Index Égalité femmes-hommes contraignant$$,
   3),

  -- Antoine Lefèvre (Union Citoyenne)
  ('antoine-lefevre', 'sante', 1,
   'Soigner partout, pour tous, par tous les moyens.',
$$## Médecine de proximité

Ouverture de **500 maisons de santé pluridisciplinaires** d''ici 2030, dont 200 dans les zones sous-dotées.

- Salariat optionnel pour les médecins en zone tendue
- Consultations avancées dans les EHPAD
- Téléconsultation systématique en zone rurale

## Hôpital public

- Embauche de 30 000 soignants
- Revalorisation salariale : +10 % pour le personnel paramédical
- Sortie progressive de la T2A (tarification à l''activité)

## Prévention

- Visite médicale annuelle gratuite pour les 50+
- Plan national santé mentale, doté de 2 Md€
- Lutte contre les déserts dentaires : 100 centres de santé bucco-dentaire publics$$,
   1),
  ('antoine-lefevre', 'securite', 1,
   'La sécurité du quotidien, c''est l''affaire de tous.',
$$## Police de proximité

Retour d''une véritable police de proximité : **10 000 agents supplémentaires** dédiés à la présence sur le terrain.

- Doublement de la présence policière dans les transports
- Création d''une réserve citoyenne renforcée
- Police municipale armée sur décision du maire

## Justice

- Recrutement de 3 000 magistrats
- Construction de 15 000 places de prison
- Justice de proximité dans chaque chef-lieu de canton$$,
   2),
  ('antoine-lefevre', 'education', 1,
   'L''école doit redevenir le grand ascenseur républicain.',
$$## Primaire

- Classes à 18 élèves maximum en zone d''éducation prioritaire
- Heures de soutien scolaire systématiques pour les enfants en difficulté
- Renforcement de la maîtrise du français et des fondamentaux

## Secondaire et supérieur

- Réforme de Parcoursup : transparence totale des algorithmes locaux
- Doublement du nombre de places en BTS
- Bourses universitaires revalorisées de 30 %$$,
   3)
) as p(slug, theme_slug, order_index, intro, content)
join public.candidates c on c.slug = p.slug
join public.themes t on t.slug = p.theme_slug;
