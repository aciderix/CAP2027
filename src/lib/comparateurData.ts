// Données du comparateur : programmes des candidats fournis par Demos Kratos
// (tables dk_*, alimentées par dk_import depuis l'export « programmes »).
// Le socle (candidats, thèmes) est chargé d'un coup ; paires, synthèses et
// mesures seulement pour les candidats sélectionnés.

import { supabase } from './supabase';
import { DK_DEFAULT_ATTRIBUTION, DK_SITE_URL, fetchDkThemeColors, fetchOurCandidates } from './dkShared';

export interface CompTheme {
  id: string;
  slug: string;
  label: string;
  /** Couleur de notre thème correspondant (dk_theme_map). */
  color: string | null;
  url: string;
}

export interface CompCandidate {
  id: string;
  slug: string;
  fullName: string;
  party: string | null;
  photoUrl: string | null;
  /** Connu seulement si le candidat est relié à une de nos fiches publiées. */
  gender: string | null;
  ourSlug: string | null;
  officialSiteUrl: string | null;
  measureCount: number;
  /** id de thème DK → nombre de mesures (une mesure peut compter dans plusieurs thèmes). */
  themeCounts: Record<string, number>;
  dkUrl: string;
}

export interface ComparateurBase {
  candidates: CompCandidate[];
  themes: CompTheme[];
  attribution: string;
  sourceUrl: string;
  generatedAt: string | null;
}

export type Verdict = 'convergents' | 'plutot_convergents' | 'divergents' | 'opposes';

export interface Affinity {
  /** Paire normalisée : a < b. */
  a: string;
  b: string;
  /** null = comparaison globale. */
  themeId: string | null;
  /** Parts des mesures comparées, de 0 à 1. */
  distribution: { convergent: number; different: number; opposed: number } | null;
  points: { sujet: string; verdict: Verdict }[];
  commentary: string | null;
  url: string;
}

export interface Synthesis {
  candidateId: string;
  /** null = synthèse globale du programme. */
  themeId: string | null;
  summary: string;
  keyMeasureIds: string[];
  keyFigures: { label: string; value: string; measureId?: string }[];
  url: string;
}

export interface Measure {
  id: string;
  candidateId: string;
  title: string;
  description: string;
  exactQuote: string;
  sourceUrl: string;
  url: string;
}

export const COMPARATEUR_QUERY_KEY = ['dkComparateur'] as const;

/** Le thème « Non classé » n'a pas sa place dans les comparaisons par thème. */
export const UNCLASSIFIED_THEME_SLUG = 'non-classe';

export async function fetchComparateurBase(): Promise<ComparateurBase> {
  const [ca, th, ours, colors, imp] = await Promise.all([
    supabase.from('dk_candidates')
      .select('id, slug, full_name, party, official_site_url, photo_url, measure_count, theme_counts, url'),
    supabase.from('dk_themes').select('id, slug, label, sort_order, url').order('sort_order'),
    fetchOurCandidates(),
    fetchDkThemeColors(),
    supabase.from('dk_imports').select('generated_at, meta').eq('kind', 'programmes')
      .order('imported_at', { ascending: false }).order('id', { ascending: false }).limit(1),
  ]);
  for (const r of [ca, th, imp]) if (r.error) throw r.error;

  const meta = (imp.data?.[0]?.meta ?? {}) as Record<string, unknown>;
  return {
    candidates: (ca.data ?? [])
      .map((c) => {
        const o = ours.get(c.id);
        return {
          id: c.id,
          slug: c.slug,
          fullName: o?.fullName ?? c.full_name,
          party: o?.party || c.party,
          photoUrl: o?.photoUrl || c.photo_url,
          gender: o?.gender ?? null,
          ourSlug: o?.slug ?? null,
          officialSiteUrl: c.official_site_url,
          measureCount: c.measure_count,
          themeCounts: (c.theme_counts ?? {}) as Record<string, number>,
          dkUrl: c.url,
        };
      })
      .sort((x, y) => x.fullName.localeCompare(y.fullName, 'fr', { sensitivity: 'base' })),
    themes: (th.data ?? []).map((t) => ({
      id: t.id, slug: t.slug, label: t.label, color: colors.get(t.id) ?? null, url: t.url,
    })),
    attribution: typeof meta.attribution === 'string' ? meta.attribution : DK_DEFAULT_ATTRIBUTION,
    sourceUrl: typeof meta.url === 'string' ? meta.url : DK_SITE_URL,
    generatedAt: imp.data?.[0]?.generated_at ?? null,
  };
}

/** Comparaisons (globale et par thème) de toutes les paires parmi `ids`. */
export async function fetchAffinities(ids: string[]): Promise<Affinity[]> {
  if (ids.length < 2) return [];
  const { data, error } = await supabase.from('dk_affinities')
    .select('candidate_a_id, candidate_b_id, theme_id, distribution, points, commentary, url')
    .in('candidate_a_id', ids).in('candidate_b_id', ids);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    a: r.candidate_a_id,
    b: r.candidate_b_id,
    themeId: r.theme_id,
    distribution: r.distribution as Affinity['distribution'],
    points: (r.points ?? []) as Affinity['points'],
    commentary: r.commentary,
    url: r.url,
  }));
}

export async function fetchSyntheses(ids: string[]): Promise<Synthesis[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('dk_syntheses')
    .select('candidate_id, theme_id, summary, key_measure_ids, key_figures, url')
    .in('candidate_id', ids);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    candidateId: r.candidate_id,
    themeId: r.theme_id,
    summary: r.summary,
    keyMeasureIds: r.key_measure_ids ?? [],
    keyFigures: (r.key_figures ?? []) as Synthesis['keyFigures'],
    url: r.url,
  }));
}

const MEASURE_COLUMNS = 'id, candidate_id, title, description, exact_quote, source_url, url';

type MeasureRow = {
  id: string; candidate_id: string; title: string; description: string;
  exact_quote: string; source_url: string; url: string;
};

function toMeasure(r: MeasureRow): Measure {
  return {
    id: r.id, candidateId: r.candidate_id, title: r.title, description: r.description,
    exactQuote: r.exact_quote, sourceUrl: r.source_url, url: r.url,
  };
}

/** Mesures d'un candidat sur un thème, par titre (l'export ne donne pas d'ordre). */
export async function fetchThemeMeasures(candidateId: string, themeId: string): Promise<Measure[]> {
  const { data, error } = await supabase.from('dk_measures')
    .select(`${MEASURE_COLUMNS}, dk_measure_themes!inner(theme_id)`)
    .eq('candidate_id', candidateId)
    .eq('dk_measure_themes.theme_id', themeId)
    .order('title')
    .limit(1000);
  if (error) throw error;
  return ((data ?? []) as unknown as MeasureRow[]).map(toMeasure);
}

/** Mesures phares (key_measure_ids des synthèses), dans l'ordre demandé. */
export async function fetchMeasuresByIds(ids: string[]): Promise<Measure[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('dk_measures').select(MEASURE_COLUMNS).in('id', ids);
  if (error) throw error;
  const byId = new Map(((data ?? []) as MeasureRow[]).map((r) => [r.id, toMeasure(r)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Part de chaque thème dans le programme d'un candidat (somme = 1). */
export function themeShares(c: CompCandidate): Map<string, number> {
  const total = Object.values(c.themeCounts).reduce((s, n) => s + n, 0);
  return new Map(Object.entries(c.themeCounts).map(([id, n]) => [id, total ? n / total : 0]));
}

export function pairKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/** Toutes les paires d'une sélection, dans l'ordre de la sélection. */
export function pairsOf(ids: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push([ids[i], ids[j]]);
  return out;
}
