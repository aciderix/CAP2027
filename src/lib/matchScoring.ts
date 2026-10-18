// Règles du Match (affirmations et positions Demos Kratos), calculées côté
// client. Spécification et choix des paramètres : docs/AUDIT_2026-10-18_RSS_DEMOS_KRATOS.md
// (section 4.6) et scripts/match_fairness_sim.py, qui simule ces mêmes règles.

export type Answer = 'pour' | 'contre' | 'neutre';
export type DkStance = 'FOR' | 'RATHER_FOR' | 'RATHER_AGAINST' | 'AGAINST';

export interface MatchStatement {
  id: string;
  text: string;
  themeSlug: string | null;
  themeLabel: string | null;
}

export interface MatchParams {
  /** Affirmations positionnées minimum pour qu'un candidat soit jouable. */
  minStatements: number;
  /** Thèmes distincts minimum pour qu'un candidat soit jouable. */
  minThemes: number;
  /** Amortissement : score = Σ poids·points / (Σ poids + k). */
  k: number;
  /** Classement affiché quand chaque jouable a au moins ce nombre de comparaisons… */
  unlockComparisons: number;
  /** … réparties sur au moins ce nombre de thèmes. */
  unlockThemes: number;
}

export const DEFAULT_MATCH_PARAMS: MatchParams = {
  minStatements: 13,
  minThemes: 10,
  k: 8,
  unlockComparisons: 6,
  unlockThemes: 3,
};

// Accord pleinement / partiellement ; le signe de la réponse s'applique dessus.
const POINTS: Record<DkStance, number> = { FOR: 1, RATHER_FOR: 0.5, RATHER_AGAINST: -0.5, AGAINST: -1 };

/** stancesByStatement[statementId][candidateId] = position */
export type StanceIndex = Record<string, Record<string, DkStance>>;

const themeKey = (s: MatchStatement) => s.themeSlug ?? 'aucun';

export interface Coverage {
  statements: number;
  themes: number;
}

export function coverageByCandidate(statements: MatchStatement[], stances: StanceIndex): Map<string, Coverage> {
  const n = new Map<string, number>();
  const t = new Map<string, Set<string>>();
  for (const s of statements) {
    for (const cid of Object.keys(stances[s.id] ?? {})) {
      n.set(cid, (n.get(cid) ?? 0) + 1);
      if (!t.has(cid)) t.set(cid, new Set());
      t.get(cid)!.add(themeKey(s));
    }
  }
  const out = new Map<string, Coverage>();
  for (const [cid, count] of n) out.set(cid, { statements: count, themes: t.get(cid)!.size });
  return out;
}

export function isPlayable(c: Coverage | undefined, p: MatchParams): boolean {
  return !!c && c.statements >= p.minStatements && c.themes >= p.minThemes;
}

/** Poids d'une affirmation : 1/√(affirmations de son thème), pour qu'un thème
 *  très représenté (institutions : 8 sur 41) ne pèse pas 20 % du score. */
export function statementWeights(statements: MatchStatement[]): Map<string, number> {
  const perTheme = new Map<string, number>();
  for (const s of statements) perTheme.set(themeKey(s), (perTheme.get(themeKey(s)) ?? 0) + 1);
  return new Map(statements.map((s) => [s.id, 1 / Math.sqrt(perTheme.get(themeKey(s))!)]));
}

export interface CandidateResult {
  candidateId: string;
  /** Score amorti dans [-1, 1]. */
  score: number;
  /** Affichage : 50 + 50 × score, arrondi. */
  pct: number;
  /** Somme brute des points (+1 / −1, ±0,5 pour « plutôt »). */
  points: number;
  agree: number;
  disagree: number;
  /** Affirmations répondues (hors « sans avis ») sur lesquelles le candidat est positionné. */
  compared: number;
  comparedThemes: number;
}

export function scoreCandidates(
  statements: MatchStatement[],
  stances: StanceIndex,
  answers: Record<string, Answer>,
  candidateIds: string[],
  p: MatchParams,
): CandidateResult[] {
  const weights = statementWeights(statements);
  const byId = new Map(statements.map((s) => [s.id, s]));
  const acc = new Map(candidateIds.map((id) => [id, {
    wp: 0, w: 0, points: 0, agree: 0, disagree: 0, compared: 0, themes: new Set<string>(),
  }]));
  for (const [sid, a] of Object.entries(answers)) {
    const s = byId.get(sid);
    if (!s || a === 'neutre') continue;
    const u = a === 'pour' ? 1 : -1;
    const w = weights.get(sid)!;
    for (const [cid, stance] of Object.entries(stances[sid] ?? {})) {
      const r = acc.get(cid);
      if (!r) continue;
      const pts = u * POINTS[stance];
      r.wp += w * pts;
      r.w += w;
      r.points += pts;
      r.compared++;
      r.themes.add(themeKey(s));
      if (pts > 0) r.agree++;
      else if (pts < 0) r.disagree++;
    }
  }
  return candidateIds
    .map((cid) => {
      const r = acc.get(cid)!;
      const score = r.wp / (r.w + p.k);
      return {
        candidateId: cid, score, pct: Math.round(50 + 50 * score),
        points: r.points, agree: r.agree, disagree: r.disagree,
        compared: r.compared, comparedThemes: r.themes.size,
      };
    })
    .sort((a, b) => b.score - a.score || b.compared - a.compared);
}

/** Le classement n'est montré que si chaque candidat jouable a été assez comparé. */
export function unlockProgress(results: CandidateResult[], p: MatchParams): { unlocked: boolean; ratio: number } {
  if (results.length === 0) return { unlocked: false, ratio: 0 };
  let ratio = 1;
  for (const r of results) {
    ratio = Math.min(ratio, r.compared / p.unlockComparisons, r.comparedThemes / p.unlockThemes);
  }
  return { unlocked: ratio >= 1, ratio: Math.max(0, Math.min(1, ratio)) };
}

/** Carte suivante : celle qui profite le plus aux candidats jouables les moins
 *  comparés, avec un bonus si son thème est nouveau pour eux, plus un léger
 *  aléa pour varier l'ordre d'une partie à l'autre. */
export function nextStatement(
  remaining: MatchStatement[],
  stances: StanceIndex,
  answers: Record<string, Answer>,
  statements: MatchStatement[],
  playableIds: Set<string>,
  random: () => number = Math.random,
): MatchStatement | null {
  if (remaining.length === 0) return null;
  const byId = new Map(statements.map((s) => [s.id, s]));
  const doneN = new Map<string, number>();
  const doneT = new Map<string, Set<string>>();
  for (const [sid, a] of Object.entries(answers)) {
    const s = byId.get(sid);
    if (!s || a === 'neutre') continue;
    for (const cid of Object.keys(stances[sid] ?? {})) {
      if (!playableIds.has(cid)) continue;
      doneN.set(cid, (doneN.get(cid) ?? 0) + 1);
      if (!doneT.has(cid)) doneT.set(cid, new Set());
      doneT.get(cid)!.add(themeKey(s));
    }
  }
  let best: MatchStatement | null = null;
  let bestGain = -Infinity;
  for (const s of remaining) {
    let gain = random() * 1e-3;
    for (const cid of Object.keys(stances[s.id] ?? {})) {
      if (!playableIds.has(cid)) continue;
      gain += 1 / (1 + (doneN.get(cid) ?? 0));
      if (!doneT.get(cid)?.has(themeKey(s))) gain += 0.5;
    }
    if (gain > bestGain) { bestGain = gain; best = s; }
  }
  return best;
}

/** Empreinte courte du texte d'une affirmation : une affirmation reformulée
 *  (même id, texte différent) est reposée. */
export function textHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
