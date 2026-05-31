-- Combler les trois thèmes sans aucun keyword (Justice, Immigration,
-- Institutions) et déplacer `justice`, `magistrat`, `magistrats` de
-- Sécurité vers Justice — ils étaient mal classés dans le seed initial,
-- ce qui faisait que les articles judiciaires étaient taggés Sécurité
-- au lieu de Justice (et que Justice restait vide).
--
-- Migration idempotente: chaque INSERT vérifie l'absence préalable via
-- NOT EXISTS, et les DELETE sur Sécurité visent des keywords précis qui
-- peuvent déjà avoir été retirés.

BEGIN;

-- 1) Retirer les keywords mal placés dans Sécurité
DELETE FROM theme_keywords
WHERE theme_id = (SELECT id FROM themes WHERE slug = 'securite')
  AND lower(keyword) IN ('justice', 'magistrat', 'magistrats');

-- 2) Insérer les keywords manquants. Helper inlined via SELECT/WHERE NOT EXISTS
--    pour rester idempotent sans contrainte unique sur (theme_id, lower(keyword)).
WITH new_kw(slug, kw) AS (
  VALUES
    -- Justice (17)
    ('justice','justice'),
    ('justice','magistrat'),
    ('justice','magistrats'),
    ('justice','parquet'),
    ('justice','procureur'),
    ('justice','procureure'),
    ('justice','juge'),
    ('justice','juges'),
    ('justice','tribunal'),
    ('justice','tribunaux'),
    ('justice','cour d''appel'),
    ('justice','cour de cassation'),
    ('justice','garde des sceaux'),
    ('justice','procès'),
    ('justice','condamnation'),
    ('justice','mise en examen'),
    ('justice','garde à vue'),
    -- Immigration (14)
    ('immigration','immigration'),
    ('immigration','immigré'),
    ('immigration','immigrés'),
    ('immigration','migrant'),
    ('immigration','migrants'),
    ('immigration','asile'),
    ('immigration','réfugié'),
    ('immigration','réfugiés'),
    ('immigration','OQTF'),
    ('immigration','sans-papiers'),
    ('immigration','expulsion'),
    ('immigration','expulsions'),
    ('immigration','regroupement familial'),
    ('immigration','centre de rétention'),
    -- Institutions (17)
    ('institutions','Élysée'),
    ('institutions','Matignon'),
    ('institutions','gouvernement'),
    ('institutions','Assemblée nationale'),
    ('institutions','Sénat'),
    ('institutions','sénateur'),
    ('institutions','sénateurs'),
    ('institutions','député'),
    ('institutions','députée'),
    ('institutions','députés'),
    ('institutions','Premier ministre'),
    ('institutions','Première ministre'),
    ('institutions','Conseil constitutionnel'),
    ('institutions','projet de loi'),
    ('institutions','référendum'),
    ('institutions','dissolution'),
    ('institutions','Constitution')
)
INSERT INTO theme_keywords (theme_id, keyword)
SELECT t.id, n.kw
FROM new_kw n
JOIN themes t ON t.slug = n.slug
WHERE NOT EXISTS (
  SELECT 1 FROM theme_keywords k
  WHERE k.theme_id = t.id
    AND lower(k.keyword) = lower(n.kw)
);

COMMIT;
