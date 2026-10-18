-- decode_html_entities existe en prod mais n'avait été créée par aucune
-- migration du dépôt (création manuelle). Sans elle, un rejeu complet des
-- migrations (supabase start / db reset en local) échoue sur
-- 20260530000000_harden_function_search_path.sql qui l'ALTER.
--
-- Définition reprise à l'identique de la prod (pg_get_functiondef).
-- CREATE OR REPLACE : sans effet si appliquée sur la prod.

create or replace function public.decode_html_entities(s text)
 returns text
 language plpgsql
 immutable
 set search_path to 'pg_catalog'
as $function$
declare
  out_text text := s;
  m record;
begin
  if out_text is null then return null; end if;

  -- Named entities
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

  -- Generic decimal numeric entities (any codepoint)
  for m in
    select distinct (regexp_matches(out_text, '&#(\d+);', 'g'))[1] as code
  loop
    begin
      out_text := replace(out_text, '&#' || m.code || ';', chr(m.code::int));
    exception when others then
      -- skip invalid codepoints
      null;
    end;
  end loop;

  -- Generic hex numeric entities (any codepoint)
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
