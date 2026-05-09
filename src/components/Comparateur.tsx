import { useEffect, useMemo, useState } from 'react';
import { Scale, LayoutGrid, Columns3, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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

type ViewMode = 'cards' | 'columns';

const VIEW_KEY = 'cap2027.comparateur.view';
const SELECTED_KEY = 'cap2027.comparateur.selected';

function fullName(c: CandidateRow) {
  return `${c.first_name} ${c.last_name}`.trim();
}
function fallbackPhoto(c: CandidateRow) {
  return c.gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

function readSelected(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SELECTED_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch { return null; }
}

export function Comparateur() {
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'cards';
    return (localStorage.getItem(VIEW_KEY) as ViewMode) || 'cards';
  });
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectionInitialised, setSelectionInitialised] = useState(false);

  const candidatesQuery = useQuery({
    queryKey: ['comparateurCandidates'],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<CandidateWithParty[]> => {
      const { data, error } = await supabase
        .from('candidates').select('*, parties(name, abbreviation, color)').eq('is_published', true);
      if (error) throw error;
      return ((data ?? []) as CandidateWithParty[]).sort((a, b) =>
        a.last_name.localeCompare(b.last_name, 'fr', { sensitivity: 'base' })
      );
    },
  });

  const themesQuery = useQuery({
    queryKey: ['themes'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<ThemeRow[]> => {
      const { data, error } = await supabase.from('themes').select('*').order('order_index');
      if (error) throw error;
      return (data ?? []) as ThemeRow[];
    },
  });

  const statementsQuery = useQuery({
    queryKey: ['matchPropositions'],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<Statement[]> => {
      const { data, error } = await supabase
        .from('candidate_match_propositions')
        .select('id, text, candidate_id, theme_id, order_index')
        .eq('is_active', true).order('order_index');
      if (error) throw error;
      return (data ?? []) as Statement[];
    },
  });

  const candidates = candidatesQuery.data ?? [];
  const themes = themesQuery.data ?? [];
  const statements = statementsQuery.data ?? [];
  const loading = candidatesQuery.isLoading || themesQuery.isLoading || statementsQuery.isLoading;
  const error =
    candidatesQuery.error?.message ||
    themesQuery.error?.message ||
    statementsQuery.error?.message ||
    null;

  // Initialise candidate selection once candidates are loaded
  useEffect(() => {
    if (selectionInitialised || candidates.length === 0) return;
    const saved = readSelected();
    const allIds = new Set(candidates.map((c) => c.id));
    if (saved && saved.length > 0) {
      setSelectedCandidates(new Set(saved.filter((id) => allIds.has(id))));
    } else {
      setSelectedCandidates(allIds);
    }
    setSelectionInitialised(true);
  }, [candidates, selectionInitialised]);

  // Persist view mode + selection
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(VIEW_KEY, viewMode);
  }, [viewMode]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SELECTED_KEY, JSON.stringify([...selectedCandidates]));
    }
  }, [selectedCandidates]);

  const themesWithContent = useMemo(() => {
    const ids = new Set(statements.map((s) => s.theme_id));
    return themes.filter((t) => ids.has(t.id));
  }, [themes, statements]);

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

  // Candidates that have content for this theme AND are selected
  const visibleCandidates = useMemo(
    () => candidates.filter((c) => byCandidate.has(c.id) && selectedCandidates.has(c.id)),
    [candidates, byCandidate, selectedCandidates]
  );

  // Candidates that have content for this theme (selected or not, used for the chip selector)
  const candidatesForTheme = useMemo(
    () => candidates.filter((c) => byCandidate.has(c.id)),
    [candidates, byCandidate]
  );

  const toggleCandidate = (id: string) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#102a5c] flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-600" />
          Comparateur thématique
        </h2>

        {/* View toggle */}
        <div className="inline-flex items-center bg-slate-100 rounded-full p-0.5 text-xs">
          <button
            onClick={() => setViewMode('cards')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold transition-all ${
              viewMode === 'cards' ? 'bg-white text-[#102a5c] shadow-sm' : 'text-slate-500'
            }`}
            aria-label="Vue cartes"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cartes</span>
          </button>
          <button
            onClick={() => setViewMode('columns')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold transition-all ${
              viewMode === 'columns' ? 'bg-white text-[#102a5c] shadow-sm' : 'text-slate-500'
            }`}
            aria-label="Vue côte à côte"
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Côte à côte</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
          Impossible de charger les données : {error}
        </div>
      )}

      {/* Themes ribbon */}
      {!loading && themesWithContent.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
            Thématique
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {themesWithContent.map((t) => {
              const active = t.id === selectedThemeId;
              const count = statements.filter((s) => s.theme_id === t.id).length;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedThemeId(t.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all whitespace-nowrap ${
                    active
                      ? 'bg-[#102a5c] text-white border-[#102a5c] shadow-sm'
                      : 'bg-white text-slate-700 border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color || '#94a3b8' }} />
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

      {/* Candidate multi-select */}
      {!loading && candidatesForTheme.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
            <span>Candidats</span>
            <div className="flex items-center gap-2 normal-case tracking-normal">
              <button
                onClick={() => setSelectedCandidates(new Set(candidatesForTheme.map((c) => c.id)))}
                className="text-[10px] font-bold text-[#1a56db] hover:underline"
              >
                Tous
              </button>
              <span className="text-slate-200">·</span>
              <button
                onClick={() => setSelectedCandidates(new Set())}
                className="text-[10px] font-bold text-slate-500 hover:underline"
              >
                Aucun
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {candidatesForTheme.map((c) => {
              const active = selectedCandidates.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCandidate(c.id)}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-xs font-bold border transition-all whitespace-nowrap ${
                    active
                      ? 'bg-[#102a5c] text-white border-[#102a5c] shadow-sm'
                      : 'bg-white text-slate-500 border-slate-100 opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className="relative w-7 h-7 rounded-full overflow-hidden bg-slate-100 shrink-0">
                    <img decoding="async" src={c.photo_url || fallbackPhoto(c)} alt="" className="w-full h-full object-cover" />
                    {active && (
                      <span className="absolute inset-0 bg-[#102a5c]/30 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  {c.last_name}
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

      {!loading && currentTheme && candidatesForTheme.length > 0 && visibleCandidates.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-100">
          Sélectionne au moins un candidat pour comparer.
        </div>
      )}

      {/* Cards mode */}
      {!loading && currentTheme && viewMode === 'cards' && visibleCandidates.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-4">
          {visibleCandidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              statements={byCandidate.get(c.id) ?? []}
              themeColor={currentTheme.color || '#94a3b8'}
            />
          ))}
        </div>
      )}

      {/* Columns (côte à côte) mode */}
      {!loading && currentTheme && viewMode === 'columns' && visibleCandidates.length > 0 && (
        <div className="-mx-2 sm:-mx-4 px-2 sm:px-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex gap-3 snap-x snap-mandatory">
            {visibleCandidates.map((c) => (
              <CandidateColumn
                key={c.id}
                candidate={c}
                statements={byCandidate.get(c.id) ?? []}
                themeColor={currentTheme.color || '#94a3b8'}
                count={visibleCandidates.length}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate, statements, themeColor,
}: {
  candidate: CandidateWithParty;
  statements: Statement[];
  themeColor: string;
}) {
  const partyLabel = candidate.parties?.abbreviation || candidate.parties?.name || '—';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col">
      <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
      <div className="p-4 flex items-center gap-3 border-b border-slate-100">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-50 shrink-0">
          <img decoding="async" src={candidate.photo_url || fallbackPhoto(candidate)} alt={fullName(candidate)} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-[#102a5c] truncate">{fullName(candidate)}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-0.5 truncate">
            {partyLabel}
          </div>
        </div>
      </div>
      <ul className="p-4 space-y-2.5">
        {statements.map((s) => (
          <li key={s.id} className="flex items-start gap-2.5 text-sm text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: themeColor }} />
            <span className="leading-snug">{s.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CandidateColumn({
  candidate, statements, themeColor, count,
}: {
  candidate: CandidateWithParty;
  statements: Statement[];
  themeColor: string;
  count: number;
}) {
  const partyLabel = candidate.parties?.abbreviation || candidate.parties?.name || '—';
  // Width: 1 col = full, 2 = ~80%, 3+ = ~70% on mobile so neighbours peek
  const widthClass =
    count === 1 ? 'w-full' :
    count === 2 ? 'w-[85%] sm:w-[48%]' :
    'w-[80%] sm:w-[44%] lg:w-[30%]';

  return (
    <div className={`shrink-0 snap-start ${widthClass} bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col`}>
      {/* Sticky header inside column */}
      <div className="bg-white border-b border-slate-100">
        <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
        <div className="p-3 flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-50">
            <img decoding="async" src={candidate.photo_url || fallbackPhoto(candidate)} alt={fullName(candidate)} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 w-full">
            <div className="font-bold text-[#102a5c] text-sm leading-tight">{fullName(candidate)}</div>
            <div
              className="text-[10px] uppercase tracking-wider font-bold mt-0.5 truncate"
              style={{ color: candidate.parties?.color || '#475569' }}
            >
              {partyLabel}
            </div>
          </div>
        </div>
      </div>
      <ul className="p-3 space-y-2 flex-1">
        {statements.length === 0 && (
          <li className="text-xs text-slate-400 italic text-center py-4">
            Pas de position sur ce thème.
          </li>
        )}
        {statements.map((s) => (
          <li
            key={s.id}
            className="text-xs sm:text-sm text-slate-700 leading-snug bg-slate-50 rounded-lg p-2.5 border border-slate-100"
          >
            {s.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
