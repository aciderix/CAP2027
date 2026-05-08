-- Mise à jour des URLs RSS après test d'endpoints alternatifs.
update public.news_sources set
  rss_url = 'https://www.liberation.fr/arc/outboundfeeds/rss-all/category/politique/?outputType=xml'
where slug = 'liberation';

update public.news_sources set
  rss_url = 'https://www.liberation.fr/arc/outboundfeeds/rss-all/category/checknews/?outputType=xml',
  is_active = true
where slug = 'checknews';

update public.news_sources set
  rss_url = 'https://www.lopinion.fr/index.rss',
  is_active = true
where slug = 'lopinion';

-- Sources injoignables (Cloudflare / 404 persistant)
update public.news_sources set is_active = false
where slug in ('humanite','lesechos-politique','afp-factuel');
