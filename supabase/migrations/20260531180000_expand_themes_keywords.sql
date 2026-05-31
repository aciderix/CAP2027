-- Expansion de la taxonomie thématique:
--   - Renomme "Institutions" en "Institutions & Politique" (slug inchangé)
--   - Ajoute 5 nouveaux thèmes: International, Technologie & Numérique,
--     Culture & Loisirs, Sport, Transports & Mobilité
--   - Enrichit massivement les keywords (~470 nouveaux)
--
-- Migration intégralement idempotente: chaque INSERT vérifie l'absence
-- préalable via NOT EXISTS, l'UPDATE est unique sur le slug. Aucun DELETE,
-- les keywords existants sont préservés.
--
-- Un backup ad hoc des deux tables a été pris avant la migration:
--   theme_keywords_backup_20260531, themes_backup_20260531

BEGIN;

-- 1) Renommer Institutions
UPDATE themes SET name = 'Institutions & Politique'
WHERE slug = 'institutions' AND name = 'Institutions';

-- 2) Créer les 5 nouveaux thèmes (idempotent)
INSERT INTO themes (slug, name, icon, color, order_index)
SELECT * FROM (VALUES
  ('international',  'International',            'Earth',   '#B91C1C', 11),
  ('technologie',    'Technologie & Numérique',  'Cpu',     '#06B6D4', 12),
  ('culture',        'Culture & Loisirs',        'Palette', '#D946EF', 13),
  ('sport',          'Sport',                    'Trophy',  '#EAB308', 14),
  ('transports',     'Transports & Mobilité',    'Bus',     '#334155', 15)
) AS new_themes(slug, name, icon, color, order_index)
WHERE NOT EXISTS (SELECT 1 FROM themes t WHERE t.slug = new_themes.slug);

-- 3) Insérer tous les keywords (le NOT EXISTS rend l'opération idempotente
--    et préserve les keywords existants)
WITH new_kw(slug, kw) AS (
  VALUES
    -- Écologie (nouveaux)
    ('ecologie','agriculture biologique'),('ecologie','artificialisation'),
    ('ecologie','biodégradable'),('ecologie','calotte glaciaire'),
    ('ecologie','canicule'),('ecologie','COP28'),('ecologie','COP29'),
    ('ecologie','décarbonation'),('ecologie','déchets'),('ecologie','déforestation'),
    ('ecologie','empreinte carbone'),('ecologie','énergies fossiles'),
    ('ecologie','fonte des glaces'),('ecologie','gaz à effet de serre'),
    ('ecologie','gaz naturel'),('ecologie','GIEC'),('ecologie','hydrogène'),
    ('ecologie','inondation'),('ecologie','méthane'),('ecologie','océan'),
    ('ecologie','pétrole'),('ecologie','réchauffement'),('ecologie','recyclage'),
    ('ecologie','sécheresse'),('ecologie','sobriété'),('ecologie','véhicule électrique'),
    ('ecologie','voiture électrique'),('ecologie','végétalisation'),
    -- Économie
    ('economie','banque'),('economie','bourse'),('economie','CAC 40'),
    ('economie','chiffre d''affaires'),('economie','commerce'),('economie','consommation'),
    ('economie','crise économique'),('economie','délocalisation'),('economie','dette'),
    ('economie','dividendes'),('economie','emploi'),('economie','entreprise'),
    ('economie','exportation'),('economie','faillite'),('economie','FMI'),
    ('economie','importation'),('economie','investissement'),('economie','licenciement'),
    ('economie','marchés financiers'),('economie','mondialisation'),('economie','notation'),
    ('economie','récession'),('economie','start-up'),('economie','taux d''intérêt'),
    ('economie','TPE'),
    -- Social
    ('social','aides sociales'),('social','assurance chômage'),('social','CAF'),
    ('social','CFDT'),('social','CGT'),('social','classes moyennes'),
    ('social','code du travail'),('social','discrimination'),('social','droits des femmes'),
    ('social','exclusion'),('social','féminisme'),('social','FO'),
    ('social','gilets jaunes'),('social','grève'),('social','handicap'),
    ('social','inégalité'),('social','jeunesse'),('social','loyer'),
    ('social','manifestation'),('social','minima sociaux'),('social','mouvement social'),
    ('social','pénibilité'),('social','racisme'),('social','sans-abri'),
    ('social','SDF'),('social','solidarité'),('social','syndicat'),
    ('social','temps de travail'),
    -- Santé
    ('sante','addiction'),('sante','ambulance'),('sante','burn-out'),
    ('sante','cancer'),('sante','chirurgie'),('sante','clinique'),
    ('sante','covid'),('sante','dépistage'),('sante','drogue'),
    ('sante','épidémie'),('sante','espérance de vie'),('sante','fin de vie'),
    ('sante','infirmier'),('sante','infirmière'),('sante','IVG'),
    ('sante','maladie'),('sante','maternité'),('sante','médicament'),
    ('sante','mutuelle'),('sante','obésité'),('sante','pandémie'),
    ('sante','pédiatrie'),('sante','SAMU'),('sante','urgences'),
    ('sante','vaccin'),('sante','vaccination'),('sante','vieillissement'),
    ('sante','virus'),
    -- Sécurité
    ('securite','agression'),('securite','agressions'),('securite','arme'),
    ('securite','assassinat'),('securite','attentat'),('securite','banditisme'),
    ('securite','braquage'),('securite','cambriolage'),('securite','criminel'),
    ('securite','cyberattaque'),('securite','cybercriminalité'),
    ('securite','émeute'),('securite','enquêteur'),('securite','extorsion'),
    ('securite','féminicide'),('securite','fraude'),('securite','garde à vue'),
    ('securite','homicide'),('securite','incivilité'),('securite','insécurité'),
    ('securite','maintien de l''ordre'),('securite','meurtre'),
    ('securite','radicalisation'),('securite','trafic'),('securite','viol'),
    ('securite','vol'),
    -- Éducation
    ('education','académie'),('education','bac'),('education','campus'),
    ('education','cantine'),('education','carte scolaire'),('education','chercheur'),
    ('education','CNRS'),('education','collégien'),('education','décrochage'),
    ('education','enseignement'),('education','enseignement supérieur'),
    ('education','harcèlement scolaire'),('education','laïcité'),
    ('education','lycéen'),('education','master'),('education','ministère de l''éducation'),
    ('education','pédagogie'),('education','recherche'),('education','rectorat'),
    ('education','rentrée scolaire'),('education','scolarité'),
    -- Europe
    ('europe','BCE'),('europe','Brexit'),('europe','CEDH'),
    ('europe','Conseil de l''Europe'),('europe','Cour de justice de l''UE'),
    ('europe','député européen'),('europe','directive européenne'),
    ('europe','espace Schengen'),('europe','Frontex'),
    ('europe','institutions européennes'),('europe','marché unique'),
    ('europe','monnaie unique'),('europe','traité européen'),
    ('europe','Ursula von der Leyen'),('europe','zone euro'),
    -- Justice
    ('justice','acquittement'),('justice','amende'),('justice','avocat'),
    ('justice','casier judiciaire'),('justice','code pénal'),
    ('justice','Conseil d''État'),('justice','contentieux'),
    ('justice','cour d''assises'),('justice','crime'),('justice','délit'),
    ('justice','détention'),('justice','enquête'),('justice','huissier'),
    ('justice','infraction'),('justice','juridiction'),('justice','juré'),
    ('justice','notaire'),('justice','plainte'),('justice','prison ferme'),
    ('justice','procédure'),('justice','sursis'),('justice','témoin'),
    -- Immigration
    ('immigration','assimilation'),('immigration','binationaux'),
    ('immigration','clandestin'),('immigration','CRA'),
    ('immigration','demande d''asile'),('immigration','droit d''asile'),
    ('immigration','droit du sang'),('immigration','droit du sol'),
    ('immigration','étranger'),('immigration','exil'),('immigration','exilé'),
    ('immigration','frontière'),('immigration','Frontex'),
    ('immigration','intégration'),('immigration','naturalisation'),
    ('immigration','passeport'),('immigration','passeur'),
    ('immigration','préfecture'),('immigration','régularisation'),
    ('immigration','titre de séjour'),('immigration','visa'),
    ('immigration','xénophobie'),
    -- Institutions & Politique (slug inchangé: 'institutions')
    ('institutions','49.3'),('institutions','abstention'),('institutions','amendement'),
    ('institutions','bureau de vote'),('institutions','campagne électorale'),
    ('institutions','circonscription'),('institutions','cohabitation'),
    ('institutions','congrès'),('institutions','conseil des ministres'),
    ('institutions','démocratie'),('institutions','droite'),
    ('institutions','élection'),('institutions','extrême droite'),
    ('institutions','extrême gauche'),('institutions','gauche'),
    ('institutions','hémicycle'),('institutions','législatives'),
    ('institutions','LFI'),('institutions','LR'),('institutions','maire'),
    ('institutions','mairie'),('institutions','majorité absolue'),
    ('institutions','mandat'),('institutions','ministre'),
    ('institutions','motion de censure'),('institutions','municipales'),
    ('institutions','parlement'),('institutions','parti politique'),
    ('institutions','président de la république'),('institutions','présidentielle'),
    ('institutions','PS'),('institutions','réforme'),('institutions','remaniement'),
    ('institutions','Renaissance'),('institutions','République'),
    ('institutions','RN'),('institutions','scrutin'),('institutions','sondage'),
    ('institutions','souveraineté'),
    -- International (nouveau, tous les keywords)
    ('international','Afrique'),('international','ambassade'),
    ('international','ambassadeur'),('international','Amérique'),
    ('international','Asie'),('international','BRICS'),
    ('international','casques bleus'),('international','cessez-le-feu'),
    ('international','Chine'),('international','colonisation'),
    ('international','consulat'),('international','Corée'),
    ('international','dictature'),('international','diplomatie'),
    ('international','diplomate'),('international','embargo'),
    ('international','espionnage'),('international','États-Unis'),
    ('international','Gaza'),('international','génocide'),
    ('international','géopolitique'),('international','guerre'),
    ('international','Hamas'),('international','ingérence'),
    ('international','invasion'),('international','Iran'),
    ('international','Israël'),('international','missile'),
    ('international','Moscou'),('international','Moyen-Orient'),
    ('international','Nations Unies'),('international','nucléaire'),
    ('international','occident'),('international','OMS'),
    ('international','ONU'),('international','Palestine'),
    ('international','Pékin'),('international','Russie'),
    ('international','sanctions'),('international','sommet'),
    ('international','Taïwan'),('international','terrorisme international'),
    ('international','traité'),('international','trêve'),
    ('international','Ukraine'),('international','Washington'),
    -- Technologie & Numérique (nouveau)
    ('technologie','5G'),('technologie','6G'),('technologie','algorithme'),
    ('technologie','Amazon'),('technologie','big data'),('technologie','bitcoin'),
    ('technologie','blockchain'),('technologie','bug'),('technologie','cloud'),
    ('technologie','crypto'),('technologie','cyber'),('technologie','deepfake'),
    ('technologie','digital'),('technologie','données personnelles'),
    ('technologie','drone'),('technologie','fibre optique'),
    ('technologie','GAFAM'),('technologie','Google'),('technologie','hacker'),
    ('technologie','IA'),('technologie','informatique'),
    ('technologie','intelligence artificielle'),('technologie','internet'),
    ('technologie','jeu vidéo'),('technologie','logiciel'),
    ('technologie','Meta'),('technologie','métavers'),
    ('technologie','Microsoft'),('technologie','numérisation'),
    ('technologie','ordinateur'),('technologie','piratage'),
    ('technologie','programmation'),('technologie','ransomware'),
    ('technologie','réseaux sociaux'),('technologie','RGPD'),
    ('technologie','robot'),('technologie','robotique'),
    ('technologie','smartphone'),('technologie','spacial'),
    ('technologie','startup'),('technologie','streaming'),
    ('technologie','technologie'),('technologie','technologique'),
    ('technologie','télécom'),('technologie','téléphone'),
    ('technologie','Tesla'),('technologie','TikTok'),('technologie','web'),
    -- Culture & Loisirs (nouveau)
    ('culture','acteur'),('culture','actrice'),('culture','album'),
    ('culture','architecture'),('culture','art'),('culture','artiste'),
    ('culture','arts'),('culture','bande dessinée'),('culture','BD'),
    ('culture','chanson'),('culture','chanteur'),('culture','chanteuse'),
    ('culture','cinéma'),('culture','concert'),('culture','culture'),
    ('culture','danse'),('culture','design'),('culture','documentaire'),
    ('culture','écrivain'),('culture','exposition'),('culture','festival'),
    ('culture','film'),('culture','humour'),('culture','jeu de société'),
    ('culture','littérature'),('culture','livre'),('culture','loisir'),
    ('culture','musée'),('culture','musique'),('culture','oeuvre'),
    ('culture','orchestre'),('culture','peinture'),('culture','photographie'),
    ('culture','podcast'),('culture','poésie'),('culture','prix littéraire'),
    ('culture','radio'),('culture','réalisateur'),('culture','roman'),
    ('culture','sculpture'),('culture','série'),('culture','spectacle'),
    ('culture','télévision'),('culture','théâtre'),('culture','tourisme'),
    ('culture','vacances'),
    -- Sport (nouveau)
    ('sport','athlétisme'),('sport','basket'),('sport','buteur'),
    ('sport','champion'),('sport','championnat'),('sport','club'),
    ('sport','coupe du monde'),('sport','cyclisme'),('sport','dopage'),
    ('sport','entraîneur'),('sport','équipe de France'),('sport','F1'),
    ('sport','FFF'),('sport','FIFA'),('sport','football'),('sport','formule 1'),
    ('sport','handball'),('sport','Jeux Olympiques'),('sport','JO'),
    ('sport','joueur'),('sport','Ligue 1'),('sport','match'),
    ('sport','médaille'),('sport','médaille d''or'),('sport','NBA'),
    ('sport','olympisme'),('sport','paralympique'),('sport','paris sportifs'),
    ('sport','pilote'),('sport','rugby'),('sport','sport'),('sport','stade'),
    ('sport','supporter'),('sport','tennis'),('sport','Tour de France'),
    ('sport','tournoi'),('sport','UEFA'),('sport','victoire'),
    -- Transports & Mobilité (nouveau)
    ('transports','accident'),('transports','aéroport'),('transports','autoroute'),
    ('transports','aviation'),('transports','avion'),('transports','bus'),
    ('transports','camion'),('transports','circulation'),
    ('transports','covoiturage'),('transports','cyclable'),
    ('transports','embouteillage'),('transports','ferroviaire'),
    ('transports','fret'),('transports','gare'),('transports','métro'),
    ('transports','mobilité'),('transports','péage'),('transports','piéton'),
    ('transports','piste cyclable'),('transports','RATP'),('transports','RER'),
    ('transports','route'),('transports','routier'),('transports','scooter'),
    ('transports','SNCF'),('transports','stationnement'),('transports','TGV'),
    ('transports','train'),('transports','tramway'),('transports','transport'),
    ('transports','transports en commun'),('transports','vélo'),
    ('transports','voiture')
)
INSERT INTO theme_keywords (theme_id, keyword)
SELECT t.id, n.kw
FROM new_kw n
JOIN themes t ON t.slug = n.slug
WHERE NOT EXISTS (
  SELECT 1 FROM theme_keywords k
  WHERE k.theme_id = t.id AND lower(k.keyword) = lower(n.kw)
);

COMMIT;
