import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';
import { ProgrammeDetail } from './ProgrammeDetail';
import { Button } from './ui/Button';

type CandidateRow = Tables<'candidates'>;
type PartyLite = Pick<Tables<'parties'>, 'name' | 'abbreviation' | 'color'>;
type CandidateWithParty = CandidateRow & { parties: PartyLite | null };

type CandidateWithCount = CandidateWithParty & { themeCount: number };

function fullName(c: CandidateRow) {
  return `${c.first_name} ${c.last_name}`.trim();
}

function fallbackPhoto(c: CandidateRow) {
  return c.gender === 'F' ? '/card_red.png' : '/card_blue.png';
}

export function ProgrammesList() {
  const [candidates, setCandidates] = useState<CandidateWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [candRes, progRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('*, parties(name, abbreviation, color)')
          .eq('is_published', true),
        supabase.from('candidate_programs').select('candidate_id'),
      ]);
      if (cancelled) return;
      if (candRes.error) {
        setError(candRes.error.message);
        setLoading(false);
        return;
      }
      const counts = new Map<string, number>();
      for (const row of progRes.data ?? []) {
        counts.set(row.candidate_id, (counts.get(row.candidate_id) ?? 0) + 1);
      }
      const enriched: CandidateWithCount[] = ((candRes.data ?? []) as CandidateWithParty[])
        .map((c) => ({ ...c, themeCount: counts.get(c.id) ?? 0 }))
        .sort((a, b) => a.last_name.localeCompare(b.last_name, 'fr', { sensitivity: 'base' }));
      setCandidates(enriched);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const name = fullName(c).toLowerCase();
      const party = (c.parties?.name || c.parties?.abbreviation || '').toLowerCase();
      return name.includes(q) || party.includes(q);
    });
  }, [candidates, search]);

  if (selectedId) {
    return (
      <ProgrammeDetail
        candidateId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full animate-in fade-in duration-300">
      <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 w-full">
        <h2 className="text-xl font-bold text-[#102a5c] shrink-0">Programmes</h2>
        <div className="relative w-full max-w-[200px] sm:w-64 sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#102a5c] focus:border-[#102a5c] text-sm transition-all shadow-sm"
            placeholder="Rechercher un candidat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
          Impossible de charger les programmes : {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-100">
          {search ? 'Aucun candidat ne correspond à votre recherche.' : 'Aucun programme publié pour le moment.'}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {loading && [1, 2, 3].map((i) => (
          <div key={`sk-${i}`} className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-1/3 h-4 bg-slate-100 animate-pulse rounded-full" />
              <div className="w-1/2 h-3 bg-slate-100 animate-pulse rounded-full" />
            </div>
          </div>
        ))}

        {filtered.map((c) => {
          const party = c.parties?.abbreviation || c.parties?.name || '—';
          const empty = c.themeCount === 0;
          return (
            <button
              key={c.id}
              onClick={() => !empty && setSelectedId(c.id)}
              disabled={empty}
              className={`bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-4 text-left transition-all w-full ${
                empty ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md hover:border-slate-200 cursor-pointer'
              }`}
            >
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-50 shrink-0">
                <img decoding="async"
                  src={c.photo_url || fallbackPhoto(c)}
                  alt={fullName(c)}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[#102a5c] truncate">{fullName(c)}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wider">{party}</span>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {empty
                      ? 'Programme à venir'
                      : `${c.themeCount} thème${c.themeCount > 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
              {!empty && <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />}
            </button>
          );
        })}
      </div>

      {!loading && !error && filtered.length > 0 && (
        <div className="text-center pt-2">
          <Button variant="outline" onClick={() => setSearch('')} className={search ? '' : 'invisible'}>
            Effacer la recherche
          </Button>
        </div>
      )}
    </div>
  );
}
