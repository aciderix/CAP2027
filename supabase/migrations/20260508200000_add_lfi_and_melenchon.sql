-- Parti
insert into public.parties (name, abbreviation, color, order_index)
values ('La France Insoumise', 'LFI', '#CC0000', 4);

-- Candidat
insert into public.candidates (
  slug, first_name, last_name, gender, birth_date, birth_place,
  short_bio, status, is_published, party_id,
  sponsorships_count, sponsorships_target, order_index, photo_url
) values (
  'jean-luc-melenchon', 'Jean-Luc', 'Mélenchon', 'M',
  '1951-08-19', 'Tanger (Maroc)',
  'Cofondateur de La France Insoumise, ancien sénateur et ministre, candidat à l''élection présidentielle 2027.',
  'declared', true,
  (select id from public.parties where abbreviation = 'LFI'),
  0, 500, 4,
  null
);

-- Bio sections
insert into public.candidate_bio_sections (candidate_id, title, content, order_index)
select c.id, s.title, s.content, s.order_index from (values
  ('Parcours', 'Né à Tanger en 1951, Jean-Luc Mélenchon est un ancien professeur de français devenu sénateur de l''Essonne, puis ministre délégué à l''Enseignement professionnel sous Lionel Jospin (2000-2002). Il quitte le PS en 2008 pour fonder le Parti de Gauche, puis La France Insoumise en 2016. Trois fois candidat à la présidentielle (2012, 2017, 2022), il a obtenu 21,95 % au premier tour en 2022.', 1),
  ('Idéologie', 'Républicain, écologiste et internationaliste, il défend une « VIe République » plus parlementaire, une planification écologique, le retour à la retraite à 60 ans et une rupture avec les traités européens jugés austéritaires. Il a popularisé en France les concepts de « créolisation » et d''« ère du peuple ».', 2),
  ('Campagne 2027', 'Tête de file de l''Union populaire, il défend la même ligne qu''en 2022 actualisée sur la transition écologique, le pouvoir d''achat et la paix internationale. Mouvement structuré autour de l''application Action populaire et du programme « L''Avenir en commun ».', 3)
) as s(title, content, order_index)
join public.candidates c on c.slug = 'jean-luc-melenchon';

-- Aliases candidat
insert into public.candidate_aliases (candidate_id, alias)
select c.id, a from (values
  ('Jean-Luc Mélenchon'),
  ('Jean-Luc Melenchon'),
  ('Mélenchon'),
  ('Melenchon'),
  ('JLM'),
  ('M. Mélenchon')
) as v(a)
join public.candidates c on c.slug = 'jean-luc-melenchon';

-- Aliases parti
insert into public.party_aliases (party_id, alias)
select p.id, a from (values
  ('La France Insoumise'),
  ('France Insoumise'),
  ('LFI'),
  ('Insoumis'),
  ('insoumise'),
  ('Union populaire')
) as v(a)
join public.parties p on p.abbreviation = 'LFI';

-- Attacher la chaîne YouTube existante au candidat
update public.news_sources
set candidate_id = (select id from public.candidates where slug = 'jean-luc-melenchon')
where slug = 'yt-jlmelenchon';
