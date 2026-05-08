import { useEffect, useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

type CandidateRow = Tables<'candidates'>;
type PartyLite = Pick<Tables<'parties'>, 'name' | 'abbreviation' | 'color'>;
type CandidateWithParty = CandidateRow & { parties: PartyLite | null };
type ThemeRow = Tables<'themes'>;

interface Statement {
  id: string;
  text: string;
  candidate_id: string;
  theme_id: string;
  order_index: number;
}

function fullName(c: CandidateRow) {
  return `${c.first_name} ${c.last_name}`.trim();
}
function fallbackPhoto(c: CandidateRow) {
  return c.gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

export function Comparateur() {
  const [candidates, setCandidates] = useState<CandidateWithParty[]>([]);
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [candRes, themeRes, stmtRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('*, parties(name, abbreviation, color)')
          .eq('is_published', true),
        supabase.from('themes').select('*').order('order_index'),
        supabase
          .from('candidate_match_propositions')
          .select('id, text, candidate_id, theme_id, order_index')
          .eq('is_active', true)
          .order('order_index'),
      ]);
      if (cancelled) return;
      if (candRes.error || themeRes.error || stmtRes.error) {
        setError(candRes.error?.message || themeRes.error?.message || stmtRes.error?.message || 'Erreur');
        setLoading(false);
        return;
      }
      const cands = ((candRes.data ?? []) as CandidateWithParty[]).sort((a, b) =>
        a.last_name.localeCompare(b.last_name, 'fr', { sensitivity: 'base' })
      );
      setCandidates(cands);
      setThemes((themeRes.data ?? []) as ThemeRow[]);
      setStatements((stmtRes.data ?? []) as Statement[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Restrict themes to those with at least one statement
  const themesWithContent = useMemo(() => {
    const ids = new Set(statements.map((s) => s.theme_id));
    return themes.filter((t) => ids.has(t.id));
  }, [themes, statements]);

  // Default-select first theme with content once data is loaded
  useEffect(() => {
    if (!selectedThemeId && themesWithContent.length > 0) {
      setSelectedThemeId(themesWithContent[0].id);
    }
  }, [themesWithContent, selectedThemeId]);

  const currentTheme = useMemo(
    () => themesWithContent.find((t) => t.id === selectedThemeId) ?? null,
    [themesWithContent, selectedThemeId]
  );

  const byCandidate = useMemo(() => {
    const map = new Map<string, Statement[]>();
    if (!selectedThemeId) return map;
    for (const s of statements) {
      if (s.theme_id !== selectedThemeId) continue;
      if (!map.has(s.candidate_id)) map.set(s.candidate_id, []);
      map.get(s.candidate_id)!.push(s);
    }
    return map;
  }, [statements, selectedThemeId]);

  const candidatesForTheme = useMemo(
    () => candidates.filter((c) => byCandidate.has(c.id)),
    [candidates, byCandidate]
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#102a5c] flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-600" />
          Comparateur thématique
        </h2>
        {currentTheme && (
          <div className="text-xs text-slate-500 hidden sm:block">
            {candidatesForTheme.length} candidat{candidatesForTheme.length > 1 ? 's' : ''} sur ce thème
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
          Impossible de charger les données : {error}
        </div>
      )}

      {/* Theme chips */}
      {!loading && themesWithContent.length > 0 && (
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 sticky top-2 z-10">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Choisir une thématique
          </div>
          <div className="flex flex-wrap gap-2">
            {themesWithContent.map((t) => {
              const active = t.id === selectedThemeId;
              const count = statements.filter((s) => s.theme_id === t.id).length;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedThemeId(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-[#102a5c] text-white border-[#102a5c] shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: t.color || '#94a3b8' }}
                  />
                  {t.name}
                  <span className={`text-[10px] font-bold ${active ? 'opacity-70' : 'text-slate-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="w-1/3 h-4 bg-slate-200 animate-pulse rounded-full" />
                  <div className="w-1/4 h-3 bg-slate-100 animate-pulse rounded-full" />
                </div>
              </div>
              {[1, 2, 3].map((j) => (
                <div key={j} className="w-full h-3 bg-slate-100 animate-pulse rounded-full mb-2" />
              ))}
            </div>
          ))}
        </div>
      )}

      {!loading && currentTheme && candidatesForTheme.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-100">
          Aucun candidat ne s'est exprimé sur ce thème pour l'instant.
        </div>
      )}

      {!loading && currentTheme && candidatesForTheme.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-4">
          {candidatesForTheme.map((c) => {
            const stmts = byCandidate.get(c.id) ?? [];
            const partyLabel = c.parties?.abbreviation || c.parties?.name || '—';
            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col"
              >
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: currentTheme.color || '#94a3b8' }}
                />
                <div className="p-4 flex items-center gap-3 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-50 shrink-0">
                    <img
                      src={c.photo_url || fallbackPhoto(c)}
                      alt={fullName(c)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#102a5c] truncate">{fullName(c)}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-0.5 truncate">
                      {partyLabel}
                    </div>
                  </div>
                </div>
                <ul className="p-4 space-y-2.5">
                  {stmts.map((s) => (
                    <li key={s.id} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
                        style={{ backgroundColor: currentTheme.color || '#94a3b8' }}
                      />
                      <span className="leading-snug">{s.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
