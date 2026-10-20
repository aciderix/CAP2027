-- Mots-clés manquants relevés sur l'actualité d'octobre 2026 (violences du
-- 17 octobre) : les titres qui ne citaient que « manifestants », « émeutes »
-- (au pluriel), « pillages », « couvre-feu » ou le Premier ministre ne
-- recevaient aucun thème. Déjà appliqué en prod.
insert into public.theme_keywords (theme_id, keyword)
select t.id, k.keyword
from (values
  ('social', 'manifestants'), ('social', 'manifestations'), ('social', 'lycéens'), ('social', 'mobilisation'),
  ('securite', 'émeutes'), ('securite', 'pillage'), ('securite', 'pillages'), ('securite', 'casseurs'),
  ('securite', 'couvre-feu'), ('securite', 'état d''urgence'),
  ('institutions', 'Lecornu')
) as k(theme_slug, keyword)
join public.themes t on t.slug = k.theme_slug
where not exists (
  select 1 from public.theme_keywords x
  where x.theme_id = t.id and lower(x.keyword) = lower(k.keyword)
);
