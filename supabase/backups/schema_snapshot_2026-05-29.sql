-- =============================================================================
-- CAP 2027 — SNAPSHOT SCHÉMA COMPLET (DDL uniquement, sans données)
-- =============================================================================
-- Projet Supabase : oyvqvfawcxlnvpgloicx (eu-central-1, Postgres 17.6)
-- Date du snapshot : 2026-05-29
-- Généré depuis le catalogue Postgres de la base de production (via MCP).
--
-- OBJET : filet de sécurité avant tout correctif. Capture la structure réelle
-- de la base — y compris les objets ABSENTS des migrations versionnées
-- (admins, is_admin, app_config, parrainages, election_results, et toutes les
-- fonctions/triggers de notification). Voir issue #8.
--
-- Inventaire : 25 tables · 1 vue · 23 fonctions · 40 policies · 21 triggers
--              · 2 types enum · 4 jobs cron statiques (section 10, restaurables
--              tels quels) + jobs election_* dynamiques.
--
-- ATTENTION : ce fichier reflète l'état AVANT les correctifs de sécurité.
-- Plusieurs policies/fonctions ci-dessous sont volontairement permissives et
-- font l'objet d'issues ouvertes (#5, #6, #7, #10, #19, #20). Ne pas rejouer
-- tel quel sur une base déjà corrigée.
--
-- Ordre de rejeu : extensions → enums → tables → contraintes → index →
--                  fonctions → triggers → RLS → policies → vue → cron.
-- =============================================================================


-- =============================================================================
-- 0. EXTENSIONS REQUISES (présentes sur le projet)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_cron;      -- jobs planifiés
CREATE EXTENSION IF NOT EXISTS pg_net;       -- net.http_post (NB: dans public, cf. advisor)
-- vault : géré par Supabase (get_fcm_service_account lit vault.decrypted_secrets)


-- =============================================================================
-- 1. TYPES ENUM
-- =============================================================================
CREATE TYPE public.affair_status AS ENUM ('mis_en_examen', 'en_cours', 'classee', 'condamnation', 'relaxe');
CREATE TYPE public.candidate_status AS ENUM ('declared', 'pressenti', 'withdrawn');


-- =============================================================================
-- 2. TABLES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid NOT NULL,
  email text,
  display_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_config (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.article_candidates (
  article_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.article_parties (
  article_id uuid NOT NULL,
  party_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.article_themes (
  article_id uuid NOT NULL,
  theme_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.candidate_affairs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status affair_status NOT NULL DEFAULT 'en_cours'::affair_status,
  date date,
  source_urls text[] NOT NULL DEFAULT '{}'::text[],
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  alias text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_bio_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_match_propositions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  theme_id uuid NOT NULL,
  text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_news (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid,
  title text NOT NULL,
  summary text,
  url text NOT NULL,
  source_name text,
  published_at timestamp with time zone NOT NULL,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  theme_id uuid NOT NULL,
  intro text,
  content text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  theme_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  source_url text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender character(1),
  photo_url text,
  birth_date date,
  birth_place text,
  party_id uuid,
  status candidate_status NOT NULL DEFAULT 'pressenti'::candidate_status,
  declared_at date,
  sponsorships_count integer NOT NULL DEFAULT 0,
  sponsorships_target integer NOT NULL DEFAULT 500,
  short_bio text,
  is_published boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  website_url text
);

CREATE TABLE IF NOT EXISTS public.election_reminders_sent (
  milestone_key text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.election_results (
  round integer NOT NULL,
  candidate_id uuid NOT NULL,
  percentage numeric(5,2) NOT NULL,
  votes bigint,
  is_qualified boolean NOT NULL DEFAULT false,
  is_winner boolean NOT NULL DEFAULT false,
  rank integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.news_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  guid text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  summary text,
  image_url text,
  author text,
  published_at timestamp with time zone NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  is_factcheck boolean NOT NULL DEFAULT false,
  verdict text,
  kind text NOT NULL DEFAULT 'article'::text
);

CREATE TABLE IF NOT EXISTS public.news_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  homepage_url text,
  rss_url text NOT NULL,
  orientation text NOT NULL,
  color text,
  is_factcheck boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_fetched_at timestamp with time zone,
  last_fetch_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'press'::text,
  candidate_id uuid,
  fetch_via_github boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.parrainages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid,
  source_name text NOT NULL,
  total integer NOT NULL,
  snapshot_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text,
  color text,
  logo_url text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.party_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL,
  alias text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_token_follows (
  token text NOT NULL,
  candidate_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_token_orientations (
  token text NOT NULL,
  orientation text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_tokens (
  token text NOT NULL,
  platform text NOT NULL,
  app_version text,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.theme_keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL,
  keyword text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.themes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  icon text,
  color text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);


-- =============================================================================
-- 3. CONTRAINTES (PK, UNIQUE, FK, CHECK)
-- =============================================================================
ALTER TABLE public.admins ADD CONSTRAINT admins_pkey PRIMARY KEY (user_id);
ALTER TABLE public.admins ADD CONSTRAINT admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.app_config ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);
ALTER TABLE public.article_candidates ADD CONSTRAINT article_candidates_pkey PRIMARY KEY (article_id, candidate_id);
ALTER TABLE public.article_candidates ADD CONSTRAINT article_candidates_article_id_fkey FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE;
ALTER TABLE public.article_candidates ADD CONSTRAINT article_candidates_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.article_parties ADD CONSTRAINT article_parties_pkey PRIMARY KEY (article_id, party_id);
ALTER TABLE public.article_parties ADD CONSTRAINT article_parties_party_id_fkey FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;
ALTER TABLE public.article_parties ADD CONSTRAINT article_parties_article_id_fkey FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE;
ALTER TABLE public.article_themes ADD CONSTRAINT article_themes_pkey PRIMARY KEY (article_id, theme_id);
ALTER TABLE public.article_themes ADD CONSTRAINT article_themes_article_id_fkey FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE;
ALTER TABLE public.article_themes ADD CONSTRAINT article_themes_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE;
ALTER TABLE public.candidate_affairs ADD CONSTRAINT candidate_affairs_pkey PRIMARY KEY (id);
ALTER TABLE public.candidate_affairs ADD CONSTRAINT candidate_affairs_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.candidate_aliases ADD CONSTRAINT candidate_aliases_pkey PRIMARY KEY (id);
ALTER TABLE public.candidate_aliases ADD CONSTRAINT candidate_aliases_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.candidate_bio_sections ADD CONSTRAINT candidate_bio_sections_pkey PRIMARY KEY (id);
ALTER TABLE public.candidate_bio_sections ADD CONSTRAINT candidate_bio_sections_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.candidate_match_propositions ADD CONSTRAINT candidate_match_propositions_pkey PRIMARY KEY (id);
ALTER TABLE public.candidate_match_propositions ADD CONSTRAINT candidate_match_propositions_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.candidate_match_propositions ADD CONSTRAINT candidate_match_propositions_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE RESTRICT;
ALTER TABLE public.candidate_news ADD CONSTRAINT candidate_news_pkey PRIMARY KEY (id);
ALTER TABLE public.candidate_news ADD CONSTRAINT candidate_news_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.candidate_programs ADD CONSTRAINT candidate_programs_candidate_id_theme_id_key UNIQUE (candidate_id, theme_id);
ALTER TABLE public.candidate_programs ADD CONSTRAINT candidate_programs_pkey PRIMARY KEY (id);
ALTER TABLE public.candidate_programs ADD CONSTRAINT candidate_programs_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.candidate_programs ADD CONSTRAINT candidate_programs_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE RESTRICT;
ALTER TABLE public.candidate_proposals ADD CONSTRAINT candidate_proposals_pkey PRIMARY KEY (id);
ALTER TABLE public.candidate_proposals ADD CONSTRAINT candidate_proposals_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE RESTRICT;
ALTER TABLE public.candidate_proposals ADD CONSTRAINT candidate_proposals_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_slug_key UNIQUE (slug);
ALTER TABLE public.candidates ADD CONSTRAINT candidates_pkey PRIMARY KEY (id);
ALTER TABLE public.candidates ADD CONSTRAINT candidates_party_id_fkey FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_gender_check CHECK ((gender = ANY (ARRAY['M'::bpchar, 'F'::bpchar])));
ALTER TABLE public.election_reminders_sent ADD CONSTRAINT election_reminders_sent_pkey PRIMARY KEY (milestone_key);
ALTER TABLE public.election_results ADD CONSTRAINT election_results_pkey PRIMARY KEY (round, candidate_id);
ALTER TABLE public.election_results ADD CONSTRAINT election_results_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.election_results ADD CONSTRAINT election_results_rank_check CHECK (((rank IS NULL) OR (rank > 0)));
ALTER TABLE public.election_results ADD CONSTRAINT election_results_votes_check CHECK (((votes IS NULL) OR (votes >= 0)));
ALTER TABLE public.election_results ADD CONSTRAINT election_results_percentage_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)));
ALTER TABLE public.election_results ADD CONSTRAINT election_results_round_check CHECK ((round = ANY (ARRAY[1, 2])));
ALTER TABLE public.news_articles ADD CONSTRAINT news_articles_source_id_guid_key UNIQUE (source_id, guid);
ALTER TABLE public.news_articles ADD CONSTRAINT news_articles_pkey PRIMARY KEY (id);
ALTER TABLE public.news_articles ADD CONSTRAINT news_articles_source_id_fkey FOREIGN KEY (source_id) REFERENCES news_sources(id) ON DELETE CASCADE;
ALTER TABLE public.news_sources ADD CONSTRAINT news_sources_slug_key UNIQUE (slug);
ALTER TABLE public.news_sources ADD CONSTRAINT news_sources_pkey PRIMARY KEY (id);
ALTER TABLE public.news_sources ADD CONSTRAINT news_sources_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;
ALTER TABLE public.parrainages ADD CONSTRAINT parrainages_source_name_snapshot_date_key UNIQUE (source_name, snapshot_date);
ALTER TABLE public.parrainages ADD CONSTRAINT parrainages_pkey PRIMARY KEY (id);
ALTER TABLE public.parrainages ADD CONSTRAINT parrainages_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;
ALTER TABLE public.parrainages ADD CONSTRAINT parrainages_total_check CHECK ((total >= 0));
ALTER TABLE public.parties ADD CONSTRAINT parties_pkey PRIMARY KEY (id);
ALTER TABLE public.party_aliases ADD CONSTRAINT party_aliases_pkey PRIMARY KEY (id);
ALTER TABLE public.party_aliases ADD CONSTRAINT party_aliases_party_id_fkey FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;
ALTER TABLE public.push_token_follows ADD CONSTRAINT push_token_follows_pkey PRIMARY KEY (token, candidate_id);
ALTER TABLE public.push_token_follows ADD CONSTRAINT push_token_follows_token_fkey FOREIGN KEY (token) REFERENCES push_tokens(token) ON DELETE CASCADE;
ALTER TABLE public.push_token_follows ADD CONSTRAINT push_token_follows_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public.push_token_orientations ADD CONSTRAINT push_token_orientations_pkey PRIMARY KEY (token, orientation);
ALTER TABLE public.push_token_orientations ADD CONSTRAINT push_token_orientations_token_fkey FOREIGN KEY (token) REFERENCES push_tokens(token) ON DELETE CASCADE;
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (token);
ALTER TABLE public.theme_keywords ADD CONSTRAINT theme_keywords_pkey PRIMARY KEY (id);
ALTER TABLE public.theme_keywords ADD CONSTRAINT theme_keywords_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE;
ALTER TABLE public.themes ADD CONSTRAINT themes_slug_key UNIQUE (slug);
ALTER TABLE public.themes ADD CONSTRAINT themes_pkey PRIMARY KEY (id);


-- =============================================================================
-- 4. INDEX (hors PK / contraintes)
-- =============================================================================
CREATE INDEX candidate_affairs_candidate_id_idx ON public.candidate_affairs USING btree (candidate_id);
CREATE INDEX candidate_aliases_alias_lower_idx ON public.candidate_aliases USING btree (lower(alias));
CREATE INDEX candidate_aliases_candidate_idx ON public.candidate_aliases USING btree (candidate_id);
CREATE INDEX candidate_bio_sections_candidate_id_idx ON public.candidate_bio_sections USING btree (candidate_id);
CREATE INDEX candidate_news_candidate_id_idx ON public.candidate_news USING btree (candidate_id);
CREATE INDEX candidate_news_published_at_idx ON public.candidate_news USING btree (published_at DESC);
CREATE INDEX candidate_programs_candidate_id_idx ON public.candidate_programs USING btree (candidate_id);
CREATE INDEX candidate_programs_theme_id_idx ON public.candidate_programs USING btree (theme_id);
CREATE INDEX candidate_proposals_candidate_id_idx ON public.candidate_proposals USING btree (candidate_id);
CREATE INDEX candidate_proposals_theme_id_idx ON public.candidate_proposals USING btree (theme_id);
CREATE INDEX candidates_is_published_idx ON public.candidates USING btree (is_published);
CREATE INDEX candidates_party_id_idx ON public.candidates USING btree (party_id);
CREATE INDEX cmp_active_idx ON public.candidate_match_propositions USING btree (is_active);
CREATE INDEX cmp_candidate_id_idx ON public.candidate_match_propositions USING btree (candidate_id);
CREATE INDEX cmp_theme_id_idx ON public.candidate_match_propositions USING btree (theme_id);
CREATE INDEX election_results_round_idx ON public.election_results USING btree (round);
CREATE INDEX idx_parrainages_candidate ON public.parrainages USING btree (candidate_id);
CREATE INDEX idx_parrainages_date ON public.parrainages USING btree (snapshot_date DESC);
CREATE INDEX news_articles_factcheck_idx ON public.news_articles USING btree (is_factcheck, published_at DESC);
CREATE INDEX news_articles_kind_idx ON public.news_articles USING btree (kind);
CREATE INDEX news_articles_published_idx ON public.news_articles USING btree (published_at DESC);
CREATE INDEX news_articles_source_idx ON public.news_articles USING btree (source_id);
CREATE INDEX news_sources_candidate_idx ON public.news_sources USING btree (candidate_id);
CREATE INDEX news_sources_fetch_via_github_idx ON public.news_sources USING btree (fetch_via_github) WHERE (fetch_via_github = true);
CREATE INDEX news_sources_kind_idx ON public.news_sources USING btree (kind);
CREATE INDEX party_aliases_alias_lower_idx ON public.party_aliases USING btree (lower(alias));
CREATE INDEX party_aliases_party_idx ON public.party_aliases USING btree (party_id);
CREATE INDEX push_token_follows_candidate_idx ON public.push_token_follows USING btree (candidate_id);
CREATE INDEX push_token_orientations_orientation_idx ON public.push_token_orientations USING btree (orientation);
CREATE INDEX theme_keywords_keyword_lower_idx ON public.theme_keywords USING btree (lower(keyword));
CREATE INDEX theme_keywords_theme_idx ON public.theme_keywords USING btree (theme_id);


-- =============================================================================
-- 5. FONCTIONS
-- NB: définitions telles qu'en production AVANT correctifs.
--     is_admin / purge_old_articles / decode_html_entities ont un search_path
--     mutable (cf. issue #20). Les fonctions unfollow_*/clear_orientations sont
--     exécutables par anon (cf. issues #7/#10).
-- =============================================================================

CREATE OR REPLACE FUNCTION public._app_config_election_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.key like 'election.%' then
    perform public.reschedule_election_reminders();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public._bump_admin_change_counter()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.app_config
  set value = jsonb_build_object(
    'counter', coalesce((value->>'counter')::int, 0) + 1,
    'at', to_jsonb(now())
  ),
  updated_at = now()
  where key = 'admin.last_change';
end;
$function$;

CREATE OR REPLACE FUNCTION public._schedule_election_milestone(job_name text, milestone_qs text, target_ts timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron', 'net'
AS $function$
declare
  cron_expr text;
  url text;
  cmd text;
  utc_ts timestamp;
begin
  if target_ts is null or target_ts <= now() then
    return;
  end if;
  utc_ts := target_ts at time zone 'UTC';
  cron_expr :=
    extract(minute from utc_ts)::int::text || ' ' ||
    extract(hour   from utc_ts)::int::text || ' ' ||
    extract(day    from utc_ts)::int::text || ' ' ||
    extract(month  from utc_ts)::int::text || ' *';
  url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/dispatch-election-reminders?milestone='
       || milestone_qs;
  cmd := format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json''), timeout_milliseconds := 60000);',
    url
  );
  perform cron.schedule(job_name, cron_expr, cmd);
end;
$function$;

CREATE OR REPLACE FUNCTION public.clear_orientations(p_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.push_token_orientations where token = p_token;
end;
$function$;

CREATE OR REPLACE FUNCTION public.decode_html_entities(s text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  out_text text := s;
  m record;
begin
  if out_text is null then return null; end if;
  out_text := replace(out_text, '&amp;',   '&');
  out_text := replace(out_text, '&nbsp;',  ' ');
  out_text := replace(out_text, '&quot;',  '"');
  out_text := replace(out_text, '&apos;',  '''');
  out_text := replace(out_text, '&laquo;', '«');
  out_text := replace(out_text, '&raquo;', '»');
  out_text := replace(out_text, '&hellip;','…');
  out_text := replace(out_text, '&mdash;', '—');
  out_text := replace(out_text, '&ndash;', '–');
  out_text := replace(out_text, '&lsquo;', '‘');
  out_text := replace(out_text, '&rsquo;', '’');
  out_text := replace(out_text, '&ldquo;', '“');
  out_text := replace(out_text, '&rdquo;', '”');
  out_text := replace(out_text, '&lt;',    '<');
  out_text := replace(out_text, '&gt;',    '>');
  for m in
    select distinct (regexp_matches(out_text, '&#(\d+);', 'g'))[1] as code
  loop
    begin
      out_text := replace(out_text, '&#' || m.code || ';', chr(m.code::int));
    exception when others then
      null;
    end;
  end loop;
  for m in
    select distinct (regexp_matches(out_text, '&#x([0-9a-fA-F]+);', 'g'))[1] as code
  loop
    begin
      out_text := regexp_replace(out_text, '&#x' || m.code || ';', chr(('x' || lpad(m.code, 8, '0'))::bit(32)::int), 'gi');
    exception when others then
      null;
    end;
  end loop;
  return out_text;
end$function$;

CREATE OR REPLACE FUNCTION public.get_election_results_for_round(p_round integer)
 RETURNS TABLE(round integer, candidate_id uuid, percentage numeric, votes bigint, is_qualified boolean, is_winner boolean, rank integer, first_name text, last_name text, photo_url text, slug text, gender character, party_name text, party_abbreviation text, party_color text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.round, r.candidate_id, r.percentage, r.votes,
    r.is_qualified, r.is_winner, r.rank,
    c.first_name, c.last_name, c.photo_url, c.slug, c.gender,
    p.name as party_name, p.abbreviation as party_abbreviation, p.color as party_color
  from public.election_results r
  join public.candidates c on c.id = r.candidate_id
  left join public.parties p on p.id = c.party_id
  where r.round = p_round
  order by r.percentage desc nulls last, r.rank asc nulls last;
$function$;

CREATE OR REPLACE FUNCTION public.get_fcm_service_account()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'vault', 'public'
AS $function$
  select decrypted_secret::text
  from vault.decrypted_secrets
  where name = 'fcm_service_account'
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (select 1 from public.admins a where a.user_id = uid);
$function$;

CREATE OR REPLACE FUNCTION public.notify_app_config_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  title text;
  body text;
  round_label text;
begin
  if NEW.key in ('election.round1', 'election.round2') then
    if coalesce((OLD.value->>'is_official')::boolean, false) = false
       and (NEW.value->>'is_official')::boolean = true then
      round_label := case NEW.key when 'election.round1' then '1er' else '2nd' end;
      title := 'Date du scrutin officialisée';
      body := 'La date du ' || round_label || ' tour de l''élection présidentielle 2027 est désormais confirmée. Ouvrez CAP 2027 pour la consulter.';
      perform public._bump_admin_change_counter();
      perform net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('title', title, 'body', body, 'type', 'date_official')
      );
    end if;
  elsif NEW.key = 'parrainages.source' then
    if coalesce((OLD.value->>'is_available')::boolean, false) = false
       and (NEW.value->>'is_available')::boolean = true then
      title := 'Parrainages disponibles';
      body := 'Le compteur officiel des 500 signatures d''élus par candidat est désormais accessible dans l''app.';
      perform public._bump_admin_change_counter();
      perform net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('title', title, 'body', body, 'type', 'parrainages_update')
      );
    end if;
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_candidate_content_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  cand_id uuid;
  cand record;
  full_name text;
  theme_name text;
  title text;
  body constant text := 'Ouvrez CAP 2027 pour découvrir les nouveautés.';
  notif_type constant text := 'candidate_updated';
begin
  if TG_TABLE_NAME = 'candidates' then
    cand_id := NEW.id;
  else
    cand_id := NEW.candidate_id;
  end if;
  select first_name, last_name, is_published
    into cand
    from public.candidates where id = cand_id;
  if cand is null or coalesce(cand.is_published, false) = false then
    return NEW;
  end if;
  full_name := trim(coalesce(cand.first_name,'') || ' ' || coalesce(cand.last_name,''));
  if TG_TABLE_NAME = 'candidates' then
    if coalesce(OLD.is_published, false) = false and NEW.is_published = true then
      return NEW;
    end if;
    if NEW.short_bio is distinct from OLD.short_bio then
      title := 'Bio courte mise à jour : ' || full_name;
    else
      return NEW;
    end if;
  elsif TG_TABLE_NAME = 'candidate_bio_sections' then
    if TG_OP = 'INSERT' then
      title := 'Nouvelle section biographique : ' || full_name;
    elsif (NEW.title is distinct from OLD.title)
       or (NEW.content is distinct from OLD.content) then
      title := 'Biographie mise à jour : ' || full_name;
    else
      return NEW;
    end if;
  elsif TG_TABLE_NAME = 'candidate_proposals' then
    select name into theme_name from public.themes where id = NEW.theme_id;
    if TG_OP = 'INSERT' then
      title := 'Nouvelle proposition (' || coalesce(theme_name, 'thématique') || ') : ' || full_name;
    elsif (NEW.title is distinct from OLD.title)
       or (NEW.content is distinct from OLD.content)
       or (NEW.source_url is distinct from OLD.source_url)
       or (NEW.theme_id is distinct from OLD.theme_id) then
      title := 'Proposition mise à jour (' || coalesce(theme_name, 'thématique') || ') : ' || full_name;
    else
      return NEW;
    end if;
  elsif TG_TABLE_NAME = 'candidate_affairs' then
    if TG_OP = 'INSERT' then
      title := 'Nouvelle affaire concernant ' || full_name;
    elsif (NEW.title is distinct from OLD.title)
       or (NEW.description is distinct from OLD.description)
       or (NEW.status is distinct from OLD.status)
       or (NEW.date is distinct from OLD.date)
       or (NEW.source_urls is distinct from OLD.source_urls) then
      title := 'Affaire mise à jour : ' || full_name;
    else
      return NEW;
    end if;
  else
    return NEW;
  end if;
  perform public._bump_admin_change_counter();
  perform net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('title', title, 'body', body, 'type', notif_type)
  );
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_candidate_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  title text;
  body text;
  is_new_publication boolean;
begin
  is_new_publication := (TG_OP = 'INSERT' and NEW.is_published = true)
    or (TG_OP = 'UPDATE' and coalesce(OLD.is_published, false) = false and NEW.is_published = true);
  if is_new_publication then
    title := 'Nouveau candidat publié : ' || trim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,''));
    body := 'Découvrez sa fiche dans CAP 2027.';
    perform public._bump_admin_change_counter();
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'candidate_published')
    );
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_election_results_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  winner_name text;
  title text;
  body constant text := 'Découvrez les scores dans CAP 2027.';
begin
  if NEW.key <> 'election.results' then
    return NEW;
  end if;
  if coalesce((OLD.value->>'round1_published')::boolean, false) = false
     and (NEW.value->>'round1_published')::boolean = true then
    title := 'Résultats du 1er tour disponibles';
    perform public._bump_admin_change_counter();
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'election_results_published')
    );
  end if;
  if coalesce((OLD.value->>'round2_published')::boolean, false) = false
     and (NEW.value->>'round2_published')::boolean = true then
    select trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,''))
      into winner_name
      from public.election_results r
      join public.candidates c on c.id = r.candidate_id
      where r.round = 2 and r.is_winner = true
      limit 1;
    title := case when winner_name is not null and length(winner_name) > 0
                  then winner_name || ' élu·e président·e'
                  else 'Résultats du 2nd tour disponibles'
             end;
    perform public._bump_admin_change_counter();
    perform net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('title', title, 'body', body, 'type', 'election_results_published')
    );
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_match_proposition_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  title text;
  body constant text := 'De nouvelles questions sont disponibles dans CAP 2027.';
begin
  if TG_OP = 'INSERT' and NEW.is_active = true then
    null;
  elsif TG_OP = 'UPDATE' and coalesce(OLD.is_active, false) = false and NEW.is_active = true then
    null;
  else
    return NEW;
  end if;
  title := 'Nouvelle proposition de boussole';
  perform public._bump_admin_change_counter();
  perform net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('title', title, 'body', body, 'type', 'match_proposition_change')
  );
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_candidate_program()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  push_url constant text := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/push-broadcast';
  cand record;
  theme_name text;
  title text;
  body text;
begin
  select first_name, last_name, is_published
    into cand
    from public.candidates where id = NEW.candidate_id;
  if cand is null or coalesce(cand.is_published, false) = false then
    return NEW;
  end if;
  select name into theme_name from public.themes where id = NEW.theme_id;
  title := 'Nouveau programme : ' || coalesce(theme_name, 'thématique')
        || ' — ' || trim(coalesce(cand.first_name,'') || ' ' || coalesce(cand.last_name,''));
  body := 'Ouvrez CAP 2027 pour consulter le programme détaillé.';
  perform public._bump_admin_change_counter();
  perform net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('title', title, 'body', body, 'type', 'new_programme')
  );
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_round_results(p_round integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cur jsonb;
  flag_key text;
begin
  if not coalesce(public.is_admin(auth.uid()), false) then
    raise exception 'Forbidden: admin only';
  end if;
  if p_round not in (1, 2) then
    raise exception 'Invalid round: %', p_round;
  end if;
  flag_key := case p_round when 1 then 'round1_published' else 'round2_published' end;
  select value into cur from public.app_config where key = 'election.results';
  if cur is null then
    cur := jsonb_build_object('round1_published', false, 'round2_published', false);
  end if;
  cur := jsonb_set(cur, array[flag_key], 'true'::jsonb, true);
  insert into public.app_config (key, value)
  values ('election.results', cur)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  if p_round = 1 then
    update public.candidates c
      set is_published = false
      where c.is_published = true
        and exists (
          select 1 from public.election_results r
          where r.candidate_id = c.id and r.round = 1 and r.is_qualified = false
        );
  else
    update public.candidates c
      set is_published = false
      where c.is_published = true
        and exists (
          select 1 from public.election_results r
          where r.candidate_id = c.id and r.round = 2 and r.is_winner = false
        );
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.purge_old_articles()
 RETURNS TABLE(deleted_total integer, deleted_factcheck integer, deleted_orphan integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_factcheck int := 0;
  v_orphan    int := 0;
begin
  with deleted as (
    delete from public.news_articles
    where is_factcheck = true
      and published_at < now() - interval '12 months'
    returning 1
  )
  select count(*) into v_factcheck from deleted;
  with deleted as (
    delete from public.news_articles a
    where a.is_factcheck = false
      and a.published_at < now() - interval '3 months'
      and not exists (
        select 1 from public.article_candidates ac
        where ac.article_id = a.id
      )
    returning 1
  )
  select count(*) into v_orphan from deleted;
  return query select (v_factcheck + v_orphan)::int, v_factcheck, v_orphan;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_election_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron', 'net'
AS $function$
declare
  rec record;
  r1 jsonb;
  r2 jsonb;
  r1_sched timestamptz;
  r2_sched timestamptz;
  r1_results timestamptz;
  r2_results timestamptz;
  r1_official boolean;
  r2_official boolean;
  r1_day_paris date;
  r2_day_paris date;
begin
  for rec in select jobname from cron.job where jobname like 'election\_%' escape '\'
  loop
    perform cron.unschedule(rec.jobname);
  end loop;
  delete from public.election_reminders_sent where milestone_key is not null;
  select value into r1 from public.app_config where key = 'election.round1';
  select value into r2 from public.app_config where key = 'election.round2';
  if r1 is not null then
    r1_sched := (r1->>'scheduled_at')::timestamptz;
    r1_results := (r1->>'results_at')::timestamptz;
    r1_official := coalesce((r1->>'is_official')::boolean, false);
    r1_day_paris := (r1_sched at time zone 'Europe/Paris')::date;
    if r1_official and r1_sched is not null then
      perform _schedule_election_milestone('election_r1_eve', 'eve&round=1', r1_sched - interval '14 hours');
      perform _schedule_election_milestone('election_r1_day', 'day&round=1', r1_sched);
      perform _schedule_election_milestone('election_r1_results', 'results&round=1', r1_results);
      perform _schedule_election_milestone('election_r1_inscription', 'inscription&round=1', ((r1_day_paris - 42)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone('election_r1_proc_3w', 'proc_3w&round=1', ((r1_day_paris - 21)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone('election_r1_proc_1w', 'proc_1w&round=1', ((r1_day_paris - 7)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone('election_r1_boussole_30', 'boussole_30&round=1', ((r1_day_paris - 30)::timestamp + interval '11 hours') at time zone 'Europe/Paris');
    end if;
  end if;
  if r2 is not null then
    r2_sched := (r2->>'scheduled_at')::timestamptz;
    r2_results := (r2->>'results_at')::timestamptz;
    r2_official := coalesce((r2->>'is_official')::boolean, false);
    r2_day_paris := (r2_sched at time zone 'Europe/Paris')::date;
    if r2_official and r2_sched is not null then
      perform _schedule_election_milestone('election_r2_eve', 'eve&round=2', r2_sched - interval '14 hours');
      perform _schedule_election_milestone('election_r2_day', 'day&round=2', r2_sched);
      perform _schedule_election_milestone('election_r2_results', 'results&round=2', r2_results);
      perform _schedule_election_milestone('election_r2_proc_3w', 'proc_3w&round=2', ((r2_day_paris - 21)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
      perform _schedule_election_milestone('election_r2_proc_1w', 'proc_1w&round=2', ((r2_day_paris - 7)::timestamp + interval '10 hours') at time zone 'Europe/Paris');
    end if;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tokens_for_press_orientation(orient text)
 RETURNS TABLE(token text, platform text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.token, t.platform
  from public.push_tokens t
  where not exists (
    select 1 from public.push_token_orientations o where o.token = t.token
  )
  or exists (
    select 1 from public.push_token_orientations o
    where o.token = t.token and o.orientation = orient
  )
$function$;

CREATE OR REPLACE FUNCTION public.tokens_for_press_orientations(orients text[])
 RETURNS TABLE(token text, platform text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.token, t.platform
  from public.push_tokens t
  where not exists (
    select 1 from public.push_token_orientations o where o.token = t.token
  )
  or exists (
    select 1 from public.push_token_orientations o
    where o.token = t.token and o.orientation = any(orients)
  )
$function$;

CREATE OR REPLACE FUNCTION public.unfollow_candidate(p_token text, p_candidate_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.push_token_follows
  where token = p_token and candidate_id = p_candidate_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.unfollow_orientation(p_token text, p_orientation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.push_token_orientations
  where token = p_token and orientation = p_orientation;
end;
$function$;

CREATE OR REPLACE FUNCTION public.unpublish_round_results(p_round integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cur jsonb;
  flag_key text;
begin
  if not coalesce(public.is_admin(auth.uid()), false) then
    raise exception 'Forbidden: admin only';
  end if;
  if p_round not in (1, 2) then
    raise exception 'Invalid round: %', p_round;
  end if;
  flag_key := case p_round when 1 then 'round1_published' else 'round2_published' end;
  select value into cur from public.app_config where key = 'election.results';
  if cur is null then
    cur := jsonb_build_object('round1_published', false, 'round2_published', false);
  end if;
  cur := jsonb_set(cur, array[flag_key], 'false'::jsonb, true);
  update public.app_config set value = cur, updated_at = now() where key = 'election.results';
  update public.candidates c
    set is_published = true
    where exists (
      select 1 from public.election_results r
      where r.candidate_id = c.id and r.round = p_round
    );
end;
$function$;


-- =============================================================================
-- 6. TRIGGERS
-- =============================================================================
CREATE TRIGGER parties_updated_at BEFORE UPDATE ON public.parties FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER themes_updated_at BEFORE UPDATE ON public.themes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER candidate_bio_sections_updated_at BEFORE UPDATE ON public.candidate_bio_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER candidate_proposals_updated_at BEFORE UPDATE ON public.candidate_proposals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER candidate_affairs_updated_at BEFORE UPDATE ON public.candidate_affairs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER candidate_programs_updated_at BEFORE UPDATE ON public.candidate_programs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER cmp_updated_at BEFORE UPDATE ON public.candidate_match_propositions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER news_sources_updated_at BEFORE UPDATE ON public.news_sources FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER election_results_updated_at BEFORE UPDATE ON public.election_results FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_app_config_notify AFTER UPDATE ON public.app_config FOR EACH ROW EXECUTE FUNCTION notify_app_config_change();
CREATE TRIGGER trg_app_config_results_notify AFTER INSERT OR UPDATE ON public.app_config FOR EACH ROW EXECUTE FUNCTION notify_election_results_published();
CREATE TRIGGER app_config_election_reschedule AFTER INSERT OR UPDATE ON public.app_config FOR EACH ROW EXECUTE FUNCTION _app_config_election_trigger();
CREATE TRIGGER trg_candidates_notify AFTER INSERT OR UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION notify_candidate_published();
CREATE TRIGGER trg_candidates_content_notify AFTER UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION notify_candidate_content_change();
CREATE TRIGGER trg_candidate_bio_sections_notify AFTER INSERT OR UPDATE ON public.candidate_bio_sections FOR EACH ROW EXECUTE FUNCTION notify_candidate_content_change();
CREATE TRIGGER trg_candidate_proposals_notify AFTER INSERT OR UPDATE ON public.candidate_proposals FOR EACH ROW EXECUTE FUNCTION notify_candidate_content_change();
CREATE TRIGGER trg_candidate_affairs_notify AFTER INSERT OR UPDATE ON public.candidate_affairs FOR EACH ROW EXECUTE FUNCTION notify_candidate_content_change();
CREATE TRIGGER trg_candidate_programs_notify AFTER INSERT ON public.candidate_programs FOR EACH ROW EXECUTE FUNCTION notify_new_candidate_program();
CREATE TRIGGER trg_match_proposition_notify AFTER INSERT OR UPDATE ON public.candidate_match_propositions FOR EACH ROW EXECUTE FUNCTION notify_match_proposition_change();


-- =============================================================================
-- 7. ROW LEVEL SECURITY (activation)
-- =============================================================================
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_bio_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_affairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_match_propositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parrainages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_reminders_sent ENABLE ROW LEVEL SECURITY;  -- aucune policy (service_role only)
ALTER TABLE public.push_token_orientations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_token_follows ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 8. POLICIES RLS  (état AVANT correctifs — voir issues #6/#7)
-- =============================================================================
CREATE POLICY admins_self_read ON public.admins AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY app_config_admin_write ON public.app_config AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY app_config_read_all ON public.app_config AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY article_candidates_public_read ON public.article_candidates AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY article_parties_public_read ON public.article_parties AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY article_themes_public_read ON public.article_themes AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY candidate_affairs_admin_write ON public.candidate_affairs AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY candidate_affairs_public_read ON public.candidate_affairs AS PERMISSIVE FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1 FROM candidates c WHERE ((c.id = candidate_affairs.candidate_id) AND (c.is_published = true)))));
CREATE POLICY candidate_aliases_admin_write ON public.candidate_aliases AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY candidate_aliases_public_read ON public.candidate_aliases AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY candidate_bio_sections_admin_write ON public.candidate_bio_sections AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY candidate_bio_sections_public_read ON public.candidate_bio_sections AS PERMISSIVE FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1 FROM candidates c WHERE ((c.id = candidate_bio_sections.candidate_id) AND (c.is_published = true)))));
CREATE POLICY candidate_match_propositions_admin_write ON public.candidate_match_propositions AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY cmp_public_read ON public.candidate_match_propositions AS PERMISSIVE FOR SELECT TO authenticated, anon USING (((is_active = true) AND (EXISTS ( SELECT 1 FROM candidates c WHERE ((c.id = candidate_match_propositions.candidate_id) AND (c.is_published = true))))));
CREATE POLICY candidate_news_public_read ON public.candidate_news AS PERMISSIVE FOR SELECT TO authenticated, anon USING (((candidate_id IS NULL) OR (EXISTS ( SELECT 1 FROM candidates c WHERE ((c.id = candidate_news.candidate_id) AND (c.is_published = true))))));
CREATE POLICY candidate_programs_admin_write ON public.candidate_programs AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY candidate_programs_public_read ON public.candidate_programs AS PERMISSIVE FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1 FROM candidates c WHERE ((c.id = candidate_programs.candidate_id) AND (c.is_published = true)))));
CREATE POLICY candidate_proposals_admin_write ON public.candidate_proposals AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY candidate_proposals_public_read ON public.candidate_proposals AS PERMISSIVE FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1 FROM candidates c WHERE ((c.id = candidate_proposals.candidate_id) AND (c.is_published = true)))));
CREATE POLICY candidates_admin_write ON public.candidates AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY candidates_public_read ON public.candidates AS PERMISSIVE FOR SELECT TO authenticated, anon USING ((is_published = true));
CREATE POLICY election_results_admin_write ON public.election_results AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY election_results_public_read ON public.election_results AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY news_articles_public_read ON public.news_articles AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY news_sources_admin_write ON public.news_sources AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY news_sources_public_read ON public.news_sources AS PERMISSIVE FOR SELECT TO authenticated, anon USING ((is_active = true));
CREATE POLICY parrainages_read_all ON public.parrainages AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY parties_admin_write ON public.parties AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY parties_public_read ON public.parties AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY party_aliases_admin_write ON public.party_aliases AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY party_aliases_public_read ON public.party_aliases AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY theme_keywords_admin_write ON public.theme_keywords AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY theme_keywords_public_read ON public.theme_keywords AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY themes_admin_write ON public.themes AS PERMISSIVE FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY themes_public_read ON public.themes AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
-- ⚠ Policies permissives (cf. issues #6/#7) :
CREATE POLICY push_tokens_anon_all ON public.push_tokens AS PERMISSIVE FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY push_token_follows_anon_delete ON public.push_token_follows AS PERMISSIVE FOR DELETE TO authenticated, anon USING (true);
CREATE POLICY push_token_follows_anon_insert ON public.push_token_follows AS PERMISSIVE FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY push_token_orientations_anon_delete ON public.push_token_orientations AS PERMISSIVE FOR DELETE TO authenticated, anon USING (true);
CREATE POLICY push_token_orientations_anon_insert ON public.push_token_orientations AS PERMISSIVE FOR INSERT TO authenticated, anon WITH CHECK (true);


-- =============================================================================
-- 9. VUE
-- =============================================================================
CREATE OR REPLACE VIEW public.parrainages_latest AS
  SELECT p.candidate_id, p.source_name, p.total, p.snapshot_date,
         c.first_name, c.last_name, c.photo_url, c.party_id
  FROM (parrainages p LEFT JOIN candidates c ON ((c.id = p.candidate_id)))
  WHERE (p.snapshot_date = ( SELECT max(parrainages.snapshot_date) AS max FROM parrainages));


-- =============================================================================
-- 10. JOBS CRON (pg_cron) — commandes réelles, restaurables telles quelles
-- =============================================================================
-- NB: les jobs ingest passent le secret x-ingest-token via la fonction
-- public.get_ingest_secret() (lue au RUNTIME, jamais stockée en clair dans
-- cron.job.command — cf. issue #7). Le secret doit exister dans Vault
-- (ingest_secret) avant que ces jobs n'aboutissent.
-- En plus de ces 4 jobs statiques, des jobs dynamiques election_* sont créés
-- au besoin par public.reschedule_election_reminders().

SELECT cron.schedule('rss-ingest-hourly', '15 * * * *', $job$
  select net.http_post(
    url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/ingest-rss',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-token', public.get_ingest_secret()),
    timeout_milliseconds := 240000
  ) as request_id;
$job$);

SELECT cron.schedule('notify-after-ingest-hourly', '16 * * * *', $job$
  select net.http_post(
    url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/notify-after-ingest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-token', public.get_ingest_secret()),
    timeout_milliseconds := 60000
  ) as request_id;
$job$);

SELECT cron.schedule('parrainages-daily', '30 6 * * *', $job$
  select net.http_post(
    url := 'https://oyvqvfawcxlnvpgloicx.supabase.co/functions/v1/fetch-parrainages',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 60000
  ) as request_id;
$job$);

SELECT cron.schedule('articles-retention-monthly', '0 4 1 * *', $job$
  select * from public.purge_old_articles();
$job$);

-- =============================================================================
-- FIN DU SNAPSHOT
-- =============================================================================
