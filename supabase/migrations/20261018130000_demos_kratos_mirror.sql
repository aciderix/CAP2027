-- Miroir des exports Demos Kratos (https://demos-kratos.fr), partenaire qui
-- fournit les programmes des candidats (mesures, synthèses, comparaisons) et
-- le jeu « Le Match ». Données sous licence CC BY-NC 4.0 : attribution
-- obligatoire (meta.attribution, lien `url` de chaque objet).
--
-- Principe : chaque export est COMPLET (pas un différentiel). dk_import()
-- remplace tout le contenu d'un type (programmes ou match) dans UNE
-- transaction, si son meta.contentHash diffère du dernier importé.
--
-- Les tables dk_* ne sont jamais éditées à la main : l'admin continue de
-- travailler sur candidates / candidate_programs / ..., qu'un import ne
-- touche pas. Le lien avec nos candidats et nos thèmes passe par deux tables
-- à part (dk_candidate_links, dk_theme_map) qui survivent aux imports.
--
-- Identifiants DK en `text` : le README les annonce en UUID, mais le thème
-- culture a l'id 'thm_culture' (export du 16/10/2026).

-- ── Suivi des imports ──────────────────────────────────────────────────────
create table if not exists public.dk_imports (
  id             bigint generated always as identity primary key,
  kind           text not null check (kind in ('programmes', 'match')),
  file_name      text not null,
  content_hash   text not null,
  generated_at   timestamptz not null,
  format_version int not null,
  counts         jsonb not null,
  meta           jsonb not null,
  imported_at    timestamptz not null default now()
);
create index if not exists dk_imports_kind_imported_idx
  on public.dk_imports (kind, imported_at desc);

-- ── Fichier « programmes » ─────────────────────────────────────────────────
create table if not exists public.dk_themes (
  id         text primary key,
  slug       text not null,
  label      text not null,
  sort_order int not null,
  url        text not null
);

create table if not exists public.dk_candidates (
  id                text primary key,
  slug              text not null,
  full_name         text not null,
  party             text,
  short_bio         text,
  official_site_url text,
  photo_url         text,
  measure_count     int not null default 0,
  theme_counts      jsonb not null default '{}'::jsonb,
  url               text not null
);

create table if not exists public.dk_measures (
  id           text primary key,
  candidate_id text not null references public.dk_candidates (id) on delete cascade,
  title        text not null,
  description  text not null,
  exact_quote  text not null,
  source_url   text not null,
  url          text not null
);
create index if not exists dk_measures_candidate_idx on public.dk_measures (candidate_id);

-- Une mesure peut relever de plusieurs thèmes « à parts égales » ;
-- position = rang dans themeIds (déjà trié dans l'ordre des thèmes).
create table if not exists public.dk_measure_themes (
  measure_id text not null references public.dk_measures (id) on delete cascade,
  theme_id   text not null references public.dk_themes (id) on delete cascade,
  position   smallint not null,
  primary key (measure_id, theme_id)
);
create index if not exists dk_measure_themes_theme_idx on public.dk_measure_themes (theme_id);

-- scope CANDIDATE : résumé global (theme_id null) ; CANDIDATE_THEME : par thème.
create table if not exists public.dk_syntheses (
  id              bigint generated always as identity primary key,
  candidate_id    text not null references public.dk_candidates (id) on delete cascade,
  scope           text not null check (scope in ('CANDIDATE', 'CANDIDATE_THEME')),
  theme_id        text references public.dk_themes (id) on delete cascade,
  summary         text not null,
  key_measure_ids text[] not null default '{}',
  key_figures     jsonb not null default '[]'::jsonb,
  url             text not null,
  unique nulls not distinct (candidate_id, theme_id)
);

-- Paire normalisée (candidate_a_id < candidate_b_id) ; theme_id null =
-- comparaison globale. distribution = {convergent, different, opposed}.
create table if not exists public.dk_affinities (
  id             bigint generated always as identity primary key,
  candidate_a_id text not null references public.dk_candidates (id) on delete cascade,
  candidate_b_id text not null references public.dk_candidates (id) on delete cascade,
  theme_id       text references public.dk_themes (id) on delete cascade,
  distribution   jsonb,
  points         jsonb not null default '[]'::jsonb,
  commentary     text,
  url            text not null,
  unique nulls not distinct (candidate_a_id, candidate_b_id, theme_id)
);
create index if not exists dk_affinities_candidate_b_idx on public.dk_affinities (candidate_b_id);

-- ── Fichier « match » (indépendant du fichier programmes) ──────────────────
create table if not exists public.dk_match_statements (
  id          text primary key,
  text        text not null,
  theme_id    text,   -- mêmes id que dk_themes, sans FK : les deux fichiers s'importent séparément
  theme_slug  text,
  theme_label text,
  sort_order  int not null
);

create table if not exists public.dk_match_candidates (
  id        text primary key,
  slug      text not null,
  full_name text not null,
  party     text,
  photo_url text,
  url       text not null
);

create table if not exists public.dk_match_stances (
  statement_id text not null references public.dk_match_statements (id) on delete cascade,
  candidate_id text not null references public.dk_match_candidates (id) on delete cascade,
  stance       text not null check (stance in ('FOR', 'RATHER_FOR', 'RATHER_AGAINST', 'AGAINST')),
  primary key (statement_id, candidate_id)
);
create index if not exists dk_match_stances_candidate_idx on public.dk_match_stances (candidate_id);

-- ── Liens avec nos données (conservés d'un import à l'autre) ───────────────
-- Table à part plutôt qu'une colonne candidates.dk_id : un UPDATE sur
-- candidates déclenche trg_candidates_content_notify (push « candidat mis à
-- jour ») ; l'import ne doit jamais toucher candidates.
create table if not exists public.dk_candidate_links (
  candidate_id    uuid primary key references public.candidates (id) on delete cascade,
  dk_candidate_id text not null unique,
  created_at      timestamptz not null default now()
);

-- Thèmes DK (27) → nos thèmes (15, utilisés pour la presse). Clé = id DK
-- (stable), slug DK pour la lisibilité ; theme_slug null = sans équivalent.
create table if not exists public.dk_theme_map (
  dk_theme_id   text primary key,
  dk_theme_slug text not null,
  theme_slug    text references public.themes (slug) on update cascade on delete set null
);

insert into public.dk_theme_map (dk_theme_id, dk_theme_slug, theme_slug) values
  ('54307445-f086-4ead-b8cb-7a8b85d36c3a', 'economie',            'economie'),
  ('4412e7c5-996c-40a7-9f8f-4750c84de727', 'fiscalite',           'economie'),
  ('f708de9a-2446-4fc7-83f5-9fc830f5ab8e', 'travail',             'social'),
  ('5ce1791a-af2e-4527-8e81-c6713496b1fc', 'retraites',           'social'),
  ('32253ca1-b13f-48e4-bce5-5f37b3cf5cd0', 'sante',               'sante'),
  ('4b46a89e-81bc-4cd6-8cab-7429d822909d', 'education',           'education'),
  ('db449839-325b-439e-b39f-a15eb124edfe', 'securite',            'securite'),
  ('765df97f-63c6-44f0-9165-55dfb6935ec1', 'justice',             'justice'),
  ('2be6ac03-6190-470c-a092-11c981a91538', 'immigration',         'immigration'),
  ('baa7fa42-1fc1-4c5c-84db-8ae57d7c92db', 'environnement',       'ecologie'),
  ('d1772e8c-2331-45a6-a05b-29c7f8b1dfe4', 'logement',            'social'),
  ('5c0e8984-fedf-40cb-a8e4-f60e657301be', 'institutions',        'institutions'),
  ('76571419-4c9b-4bf5-a49c-d615085ea533', 'international',       'international'),
  ('65e51f6a-0b9a-45a5-bb55-ab883af41ec3', 'numerique',           'technologie'),
  ('thm_culture',                          'culture',             'culture'),
  ('e20729e4-cf14-49db-acd0-4b991ca14e33', 'transport',           'transports'),
  ('c2ed0e74-398b-4aa9-84e9-3dcf51735e0b', 'outre-mer',           'institutions'),
  ('1ee7966e-6365-4b88-bff3-b8730529e12a', 'agriculture',         'economie'),      -- à trancher (C2) : economie ou ecologie
  ('7e90ced4-a58a-4c2c-90d1-323b488e1353', 'sport',               'sport'),
  ('4aed6f0d-11d4-4062-8514-fd0e70e73b85', 'politique-familiale', 'social'),
  ('268954ad-5093-4b8c-903b-83dd877d9b11', 'defense',             'international'), -- à trancher (C2) : international ou securite
  ('dec44c28-bf25-4439-9d17-f90581332c62', 'protection-animale',  'ecologie'),
  ('d504e176-584a-411a-bb53-5c1bca3319cb', 'protection-sociale',  'social'),
  ('fb8fd953-964a-4f5f-84a5-bfb10c1a6b4a', 'industrie',           'economie'),
  ('ca23f13a-2927-4fd4-aa9d-48304d5690f6', 'science',             'technologie'),
  ('7b129965-528c-4f68-a15a-d4683ff4bda3', 'energie',             'ecologie'),
  ('dc91a7ec-5a84-41b9-8dca-463c08484dd2', 'non-classe',          null)
on conflict (dk_theme_id) do nothing;

-- ── Droits : lecture publique, écriture réservée au service role ───────────
do $$
declare t text;
begin
  foreach t in array array[
    'dk_imports', 'dk_themes', 'dk_candidates', 'dk_measures', 'dk_measure_themes',
    'dk_syntheses', 'dk_affinities', 'dk_match_statements', 'dk_match_candidates',
    'dk_match_stances', 'dk_candidate_links', 'dk_theme_map'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    if t <> 'dk_candidate_links' then
      execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
      execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                     t || '_public_read', t);
    end if;
  end loop;
end $$;

-- Les liens ne sont visibles que pour les candidats publiés (même règle que
-- candidates_public_read).
drop policy if exists dk_candidate_links_public_read on public.dk_candidate_links;
create policy dk_candidate_links_public_read on public.dk_candidate_links
  for select to anon, authenticated
  using (exists (select 1 from public.candidates c where c.id = candidate_id and c.is_published));

-- ── Import ─────────────────────────────────────────────────────────────────
-- dk_import(export complet, nom du fichier) → résumé jsonb.
-- Vérifie format, version et compteurs ; ne fait rien si le contentHash est
-- celui du dernier import du même type ; sinon remplace tout, puis relie par
-- slug les candidats DK à nos candidats encore non reliés.
create or replace function public.dk_import(p_payload jsonb, p_file_name text)
returns jsonb
language plpgsql
set search_path to ''
as $$
declare
  v_meta   jsonb := p_payload -> 'meta';
  v_hash   text  := p_payload -> 'meta' ->> 'contentHash';
  v_kind   text;
  v_key    text;
  v_count  text;
  v_linked int := 0;
begin
  case v_meta ->> 'format'
    when 'demos-kratos/programmes' then v_kind := 'programmes';
    when 'demos-kratos/match'      then v_kind := 'match';
    else raise exception 'dk_import: format inconnu %', v_meta ->> 'format';
  end case;
  if (v_meta ->> 'version') is distinct from '1' then
    raise exception 'dk_import: version % non supportée', v_meta ->> 'version';
  end if;
  if coalesce(v_hash, '') = '' then
    raise exception 'dk_import: meta.contentHash absent';
  end if;
  for v_key, v_count in select key, value from jsonb_each_text(v_meta -> 'counts') loop
    if jsonb_array_length(coalesce(p_payload -> v_key, '[]'::jsonb)) <> v_count::int then
      raise exception 'dk_import: meta.counts.% = % mais % éléments',
        v_key, v_count, jsonb_array_length(coalesce(p_payload -> v_key, '[]'::jsonb));
    end if;
  end loop;

  -- Un seul import à la fois.
  perform pg_advisory_xact_lock(hashtext('public.dk_import'));

  if v_hash = (select content_hash from public.dk_imports
               where kind = v_kind order by imported_at desc, id desc limit 1) then
    return jsonb_build_object('kind', v_kind, 'skipped', true, 'content_hash', v_hash);
  end if;

  if v_kind = 'programmes' then
    delete from public.dk_affinities where true;
    delete from public.dk_syntheses where true;
    delete from public.dk_measure_themes where true;
    delete from public.dk_measures where true;
    delete from public.dk_candidates where true;
    delete from public.dk_themes where true;

    insert into public.dk_themes (id, slug, label, sort_order, url)
    select t ->> 'id', t ->> 'slug', t ->> 'label', (t ->> 'order')::int, t ->> 'url'
    from jsonb_array_elements(p_payload -> 'themes') t;

    insert into public.dk_candidates (id, slug, full_name, party, short_bio, official_site_url,
                                      photo_url, measure_count, theme_counts, url)
    select c ->> 'id', c ->> 'slug', c ->> 'fullName', c ->> 'party', nullif(c ->> 'shortBio', ''),
           c ->> 'officialSiteUrl', c ->> 'photoUrl', coalesce((c ->> 'measureCount')::int, 0),
           coalesce(c -> 'themeCounts', '{}'::jsonb), c ->> 'url'
    from jsonb_array_elements(p_payload -> 'candidates') c;

    insert into public.dk_measures (id, candidate_id, title, description, exact_quote, source_url, url)
    select m ->> 'id', m ->> 'candidateId', m ->> 'title', m ->> 'description',
           m ->> 'exactQuote', m ->> 'sourceUrl', m ->> 'url'
    from jsonb_array_elements(p_payload -> 'measures') m;

    insert into public.dk_measure_themes (measure_id, theme_id, position)
    select m ->> 'id', t.value, t.ord - 1
    from jsonb_array_elements(p_payload -> 'measures') m,
         jsonb_array_elements_text(m -> 'themeIds') with ordinality t(value, ord);

    insert into public.dk_syntheses (candidate_id, scope, theme_id, summary, key_measure_ids, key_figures, url)
    select s ->> 'candidateId', s ->> 'scope', s ->> 'themeId', s ->> 'summary',
           array(select jsonb_array_elements_text(coalesce(s -> 'keyMeasureIds', '[]'::jsonb))),
           coalesce(s -> 'keyFigures', '[]'::jsonb), s ->> 'url'
    from jsonb_array_elements(p_payload -> 'syntheses') s;

    insert into public.dk_affinities (candidate_a_id, candidate_b_id, theme_id, distribution,
                                      points, commentary, url)
    select a ->> 'candidateAId', a ->> 'candidateBId', a ->> 'themeId',
           case when jsonb_typeof(a -> 'distribution') = 'object' then a -> 'distribution' end,
           coalesce(a -> 'points', '[]'::jsonb), a ->> 'commentary', a ->> 'url'
    from jsonb_array_elements(p_payload -> 'affinities') a;

    insert into public.dk_candidate_links (candidate_id, dk_candidate_id)
    select c.id, d.id from public.candidates c join public.dk_candidates d on d.slug = c.slug
    on conflict do nothing;
    get diagnostics v_linked = row_count;
  else
    delete from public.dk_match_stances where true;
    delete from public.dk_match_statements where true;
    delete from public.dk_match_candidates where true;

    insert into public.dk_match_statements (id, text, theme_id, theme_slug, theme_label, sort_order)
    select s ->> 'id', s ->> 'text', s -> 'theme' ->> 'id', s -> 'theme' ->> 'slug',
           s -> 'theme' ->> 'label', (s ->> 'order')::int
    from jsonb_array_elements(p_payload -> 'statements') s;

    insert into public.dk_match_candidates (id, slug, full_name, party, photo_url, url)
    select c ->> 'id', c ->> 'slug', c ->> 'fullName', c ->> 'party', c ->> 'photoUrl', c ->> 'url'
    from jsonb_array_elements(p_payload -> 'candidates') c;

    insert into public.dk_match_stances (statement_id, candidate_id, stance)
    select s ->> 'statementId', s ->> 'candidateId', s ->> 'stance'
    from jsonb_array_elements(p_payload -> 'stances') s;

    insert into public.dk_candidate_links (candidate_id, dk_candidate_id)
    select c.id, d.id from public.candidates c join public.dk_match_candidates d on d.slug = c.slug
    on conflict do nothing;
    get diagnostics v_linked = row_count;
  end if;

  insert into public.dk_imports (kind, file_name, content_hash, generated_at, format_version, counts, meta)
  values (v_kind, p_file_name, v_hash, (v_meta ->> 'generatedAt')::timestamptz,
          (v_meta ->> 'version')::int, coalesce(v_meta -> 'counts', '{}'::jsonb), v_meta);

  return jsonb_build_object('kind', v_kind, 'skipped', false, 'content_hash', v_hash,
                            'counts', v_meta -> 'counts', 'candidates_linked', v_linked);
end;
$$;

revoke all on function public.dk_import(jsonb, text) from public, anon, authenticated;
grant execute on function public.dk_import(jsonb, text) to service_role;
