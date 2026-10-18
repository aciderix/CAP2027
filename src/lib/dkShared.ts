// Données Demos Kratos communes au Match et au comparateur : nos fiches
// reliées aux candidats DK (dk_candidate_links), couleurs de thème
// (dk_theme_map → themes) et attribution. Les deux fichiers d'export DK
// (programmes, match) partagent les mêmes id de candidats et de thèmes.

import { supabase } from './supabase';

/** Notre fiche, pour un candidat DK relié à un de nos candidats publiés. */
export interface OurCandidate {
  slug: string;
  fullName: string;
  party: string | null;
  photoUrl: string | null;
  gender: string | null;
}

type LinkRow = {
  dk_candidate_id: string;
  candidates: {
    slug: string; first_name: string; last_name: string; gender: string | null; photo_url: string | null;
    parties: { name: string | null; abbreviation: string | null } | null;
  } | null;
};

/** id DK → notre fiche. RLS : seuls les liens vers des candidats publiés sont visibles. */
export async function fetchOurCandidates(): Promise<Map<string, OurCandidate>> {
  const { data, error } = await supabase.from('dk_candidate_links')
    .select('dk_candidate_id, candidates(slug, first_name, last_name, gender, photo_url, parties(name, abbreviation))');
  if (error) throw error;
  const out = new Map<string, OurCandidate>();
  for (const l of (data as unknown as LinkRow[]) ?? []) {
    const c = l.candidates;
    if (!c) continue;
    out.set(l.dk_candidate_id, {
      slug: c.slug,
      fullName: `${c.first_name} ${c.last_name}`.trim(),
      party: c.parties?.name || c.parties?.abbreviation || null,
      photoUrl: c.photo_url,
      gender: c.gender,
    });
  }
  return out;
}

/** id de thème DK → couleur de notre thème correspondant (dk_theme_map). */
export async function fetchDkThemeColors(): Promise<Map<string, string | null>> {
  const [map, themes] = await Promise.all([
    supabase.from('dk_theme_map').select('dk_theme_id, theme_slug'),
    supabase.from('themes').select('slug, color'),
  ]);
  if (map.error) throw map.error;
  if (themes.error) throw themes.error;
  const colorBySlug = new Map((themes.data ?? []).map((t) => [t.slug, t.color]));
  return new Map((map.data ?? []).map((m) => [
    m.dk_theme_id, (m.theme_slug && colorBySlug.get(m.theme_slug)) || null,
  ]));
}

export const DK_SITE_URL = 'https://demos-kratos.fr/';
export const DK_LICENCE_URL = 'https://creativecommons.org/licenses/by-nc/4.0/deed.fr';
export const DK_DEFAULT_ATTRIBUTION =
  "Données : demos-kratos.fr — extraites des programmes officiels, de manière neutre, avec des outils utilisant l'IA.";
