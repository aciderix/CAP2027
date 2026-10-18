// Données du Match : affirmations et positions des candidats fournies par
// Demos Kratos (tables dk_match_*, alimentées par dk_import), et réponses de
// l'utilisateur. Partagé entre la carte d'accueil (badge) et le jeu.

import { supabase } from './supabase';
import { textHash, type Answer, type DkStance, type MatchStatement, type StanceIndex } from './matchScoring';
import { DK_DEFAULT_ATTRIBUTION, fetchDkThemeColors, fetchOurCandidates } from './dkShared';

export interface MatchCandidate {
  /** id Demos Kratos (clé des positions). */
  id: string;
  fullName: string;
  party: string | null;
  photoUrl: string | null;
  /** Photo servie par notre Storage (avec CORS) : seule utilisable dans
   *  l'image de partage. Les photos demos-kratos.fr n'ont pas d'en-tête CORS ;
   *  on ne les précharge pas, pour ne pas multiplier les requêtes chez eux. */
  photoIsOurs: boolean;
  /** Connu seulement si le candidat est relié à une de nos fiches publiées. */
  gender: string | null;
  /** Notre fiche, si elle existe et est publiée. */
  ourSlug: string | null;
  /** Page du candidat sur demos-kratos.fr. */
  dkUrl: string;
}

export interface MatchData {
  statements: (MatchStatement & { themeColor: string | null })[];
  stances: StanceIndex;
  candidates: MatchCandidate[];
  /** meta.contentHash du dernier import « match » : change à chaque nouvel export. */
  version: string | null;
  sourceUrl: string;
  methodologyUrl: string;
  attribution: string;
}

export const MATCH_QUERY_KEY = ['dkMatch'] as const;

const DEFAULT_SOURCE_URL = 'https://demos-kratos.fr/swipe/';
const DEFAULT_METHOD_URL = 'https://demos-kratos.fr/swipe/methode/';

// PostgREST plafonne les réponses (1 000 lignes sur Supabase) : on pagine
// les positions, qui grossiront avec les programmes publiés.
async function fetchAllStances() {
  const rows: { statement_id: string; candidate_id: string; stance: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('dk_match_stances')
      .select('statement_id, candidate_id, stance')
      .order('statement_id')
      .order('candidate_id')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function fetchMatchData(): Promise<MatchData> {
  const [st, stances, ca, ours, themeColors, imp] = await Promise.all([
    supabase.from('dk_match_statements').select('id, text, theme_slug, theme_label, theme_id').order('sort_order'),
    fetchAllStances(),
    supabase.from('dk_match_candidates').select('id, full_name, party, photo_url, url'),
    fetchOurCandidates(),
    fetchDkThemeColors(),
    supabase.from('dk_imports').select('content_hash, meta').eq('kind', 'match')
      .order('imported_at', { ascending: false }).order('id', { ascending: false }).limit(1),
  ]);
  for (const r of [st, ca, imp]) if (r.error) throw r.error;

  const index: StanceIndex = {};
  for (const s of stances) (index[s.statement_id] ??= {})[s.candidate_id] = s.stance as DkStance;

  const meta = (imp.data?.[0]?.meta ?? {}) as Record<string, unknown>;
  return {
    statements: (st.data ?? []).map((s) => ({
      id: s.id, text: s.text, themeSlug: s.theme_slug, themeLabel: s.theme_label,
      themeColor: (s.theme_id && themeColors.get(s.theme_id)) || null,
    })),
    stances: index,
    // Un candidat relié à une de nos fiches publiées prend notre photo (servie
    // avec CORS, donc utilisable dans l'image de partage) et notre parti.
    candidates: (ca.data ?? []).map((c) => {
      const o = ours.get(c.id);
      return {
        id: c.id,
        fullName: o?.fullName ?? c.full_name,
        party: o?.party || c.party,
        photoUrl: o?.photoUrl || c.photo_url,
        photoIsOurs: !!o?.photoUrl,
        gender: o?.gender ?? null,
        ourSlug: o?.slug ?? null,
        dkUrl: c.url,
      };
    }),
    version: imp.data?.[0]?.content_hash ?? null,
    sourceUrl: typeof meta.url === 'string' ? meta.url : DEFAULT_SOURCE_URL,
    methodologyUrl: typeof meta.methodologyUrl === 'string' ? meta.methodologyUrl : DEFAULT_METHOD_URL,
    attribution: typeof meta.attribution === 'string' ? meta.attribution : DK_DEFAULT_ATTRIBUTION,
  };
}

// ── Réponses (localStorage, miroir Capacitor Preferences) ──────────────────
// v3 : réponses aux affirmations Demos Kratos, avec l'empreinte du texte
// répondu. Les réponses v2 portaient sur les anciennes propositions par
// candidat : elles ne sont pas reprises.
export const ANSWERS_KEY = 'cap2027.matchAnswers.v3';
// Dernière version du Match vue (contentHash) et candidats jouables à ce
// moment-là : sert à annoncer « nouveaux choix » et « X rejoint le Match ».
export const SEEN_KEY = 'cap2027.matchSeen.v3';

export type StoredAnswers = Record<string, { a: Answer; h: string }>;
export interface SeenState { version: string | null; playable: string[] }

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function mirrorToPreferences(key: string, value: string) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
  } catch {
    // best-effort
  }
}

/** Restaure depuis Preferences si localStorage a été vidé (sauvegarde /
 *  restauration Android, nettoyage du stockage de la WebView…). */
export async function restoreMatchStateIfMissing(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Preferences } = await import('@capacitor/preferences');
    for (const key of [ANSWERS_KEY, SEEN_KEY]) {
      if (localStorage.getItem(key)) continue;
      const { value } = await Preferences.get({ key });
      if (value) localStorage.setItem(key, value);
    }
  } catch {
    // best-effort
  }
}

export function loadStoredAnswers(): StoredAnswers {
  return readJson<StoredAnswers>(ANSWERS_KEY, {});
}

export function saveStoredAnswers(a: StoredAnswers) {
  if (typeof window === 'undefined') return;
  const value = JSON.stringify(a);
  localStorage.setItem(ANSWERS_KEY, value);
  void mirrorToPreferences(ANSWERS_KEY, value);
}

export function loadSeen(): SeenState | null {
  return readJson<SeenState | null>(SEEN_KEY, null);
}

export function saveSeen(s: SeenState) {
  if (typeof window === 'undefined') return;
  const value = JSON.stringify(s);
  localStorage.setItem(SEEN_KEY, value);
  void mirrorToPreferences(SEEN_KEY, value);
}

/** Réponses encore valables : affirmation toujours présente et texte inchangé
 *  (une affirmation reformulée est reposée). */
export function validAnswers(stored: StoredAnswers, statements: MatchStatement[]): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  for (const s of statements) {
    const r = stored[s.id];
    if (r && r.h === textHash(s.text)) out[s.id] = r.a;
  }
  return out;
}
