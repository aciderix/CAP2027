-- Le Figaro (Politique et FigaroVox), Atlantico et Le Point passent à droite,
-- d'après leur article Wikipédia : Le Figaro « issue des trois grandes
-- familles de la droite », Atlantico « classé à droite ou droite dure »,
-- Le Point « traditionnellement classé à droite ». Catégorie existante :
-- aucune mise à jour de l'appli nécessaire. Déjà appliqué en prod.
update public.news_sources
set orientation = 'droite'
where slug in ('lefigaro-politique', 'lefigaro-vox', 'atlantico', 'lepoint-24h');
