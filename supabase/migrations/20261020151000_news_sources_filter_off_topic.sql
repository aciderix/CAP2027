-- Chaînes de médias généralistes (Sud Radio, Brut sur YouTube) : elles
-- publient aussi du divertissement, du sport, des conseils de vie. Pour ces
-- sources, ingest-rss ne garde que les éléments qui citent un candidat ou un
-- parti, ou qui relèvent d'un thème de politique publique. Les autres chaînes
-- (Blast, HugoDécrypte, Thinkerview…) sont presque entièrement politiques :
-- le filtre par mots-clés y écarterait surtout des vidéos pertinentes.
-- Déjà appliqué en prod.
alter table public.news_sources
  add column if not exists filter_off_topic boolean not null default false;

update public.news_sources set filter_off_topic = true
where slug in ('yt-sudradio', 'yt-brut');
